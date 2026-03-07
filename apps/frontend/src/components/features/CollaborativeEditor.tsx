'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Code, Quote, Undo, Redo, WifiOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';

interface CollaborativeEditorProps {
  pageId: string;
  editable?: boolean;
}

const COLORS = ['#958DF1', '#F98181', '#FBBC88', '#FAF594', '#70CFF8', '#94FADB', '#B9F18D'];

function getRandomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export function CollaborativeEditor({ pageId, editable = true }: CollaborativeEditorProps) {
  const user = useAuthStore((s) => s.user);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [synced, setSynced] = useState(false);
  const destroyedRef = useRef(false);

  const { ydoc, provider } = useMemo(() => {
    destroyedRef.current = false;
    const ydoc = new Y.Doc();
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234';
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : '';

    const provider = new HocuspocusProvider({
      url: wsUrl,
      name: `page:${pageId}`,
      document: ydoc,
      token,
      onConnect() {
        if (!destroyedRef.current) setStatus('connected');
      },
      onClose() {
        if (!destroyedRef.current) setStatus('disconnected');
      },
      onSynced() {
        if (!destroyedRef.current) setSynced(true);
      },
      // Reconnect is handled by default by HocuspocusProvider
    });

    return { ydoc, provider };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  useEffect(() => {
    return () => {
      destroyedRef.current = true;
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          // @ts-expect-error -- history disabled for Yjs collaboration
          history: false,
        }),
        Placeholder.configure({
          placeholder: 'Start writing collaboratively...',
        }),
        Collaboration.configure({
          document: ydoc,
        }),
        CollaborationCursor.configure({
          provider,
          user: {
            name: user?.name || 'Anonymous',
            color: getRandomColor(),
          },
        }),
      ],
      editable,
      editorProps: {
        attributes: {
          class: 'prose prose-sm dark:prose-invert max-w-none min-h-[400px] focus:outline-none px-1 py-2',
        },
      },
    },
    // Re-create editor when ydoc/provider changes (i.e. when pageId changes)
    [ydoc, provider]
  );

  // Show loading until first sync
  if (!synced) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border p-12">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          {status === 'disconnected' ? (
            <>
              <WifiOff className="h-8 w-8" />
              <p className="text-sm">Unable to connect to collaboration server</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatus('connecting');
                  provider.connect();
                }}
              >
                Retry
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Connecting to editor…</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!editor) return null;

  const ToolbarButton = ({
    onClick,
    isActive,
    children,
    title,
  }: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-8 w-8', isActive && 'bg-accent')}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </Button>
  );

  return (
    <div className="rounded-lg border border-border">
      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border p-1">
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold">
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic">
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="Heading 1">
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Heading 2">
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List">
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Ordered List">
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title="Code Block">
            <Code className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Quote">
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <div className="mx-1 h-6 w-px bg-border" />
          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
            <Redo className="h-4 w-4" />
          </ToolbarButton>

          {/* Connection status */}
          <div className="ml-auto flex items-center gap-1 px-2">
            <div
              className={cn(
                'h-2 w-2 rounded-full',
                status === 'connected' ? 'bg-green-500' : status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
              )}
            />
            <span className="text-xs text-muted-foreground">
              {status === 'connected' ? 'Live' : status === 'connecting' ? 'Connecting…' : 'Offline'}
            </span>
          </div>
        </div>
      )}
      <div className="p-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
