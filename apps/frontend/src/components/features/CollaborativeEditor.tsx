'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { ResizableImageExtension } from './editor/ResizableImageExtension';
import { Link } from '@tiptap/extension-link';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Underline } from '@tiptap/extension-underline';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Superscript } from '@tiptap/extension-superscript';
import { Subscript } from '@tiptap/extension-subscript';
import { Typography } from '@tiptap/extension-typography';
import { CharacterCount } from '@tiptap/extension-character-count';
import { SlashCommandExtension } from './editor/SlashCommandExtension';
import { slashCommandSuggestion } from './editor/slashCommandSuggestion';
import { CalloutExtension } from './editor/CalloutExtension';
import { CodeBlockExtension } from './editor/CodeBlockExtension';
import { createMentionExtension } from './editor/MentionExtension';
import { EmojiPickerButton } from './editor/EmojiPickerButton';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, ListChecks,
  Heading1, Heading2, Heading3,
  Code, Quote, Minus,
  Undo, Redo,
  WifiOff, Loader2,
  Table as TableIcon, ImagePlus, Link as LinkIcon,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Highlighter, Superscript as SuperscriptIcon, Subscript as SubscriptIcon,
  Plus, Trash2, Columns, Rows,
  Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import { api } from '@/lib/api';

interface CollaborativeEditorProps {
  pageId: string;
  spaceSlug?: string;
  editable?: boolean;
  onEditorReady?: (editor: any) => void;
}

const COLORS = ['#958DF1', '#F98181', '#FBBC88', '#FAF594', '#70CFF8', '#94FADB', '#B9F18D'];
const TEXT_COLORS = [
  '#000000', '#434343', '#666666', '#999999',
  '#e03131', '#c2255c', '#9c36b5', '#6741d9',
  '#3b5bdb', '#1971c2', '#0c8599', '#099268',
  '#2f9e44', '#66a80f', '#f08c00', '#e8590c',
];
const HIGHLIGHT_COLORS = [
  '#ffc078', '#ffd43b', '#a9e34b', '#69db7c',
  '#66d9e8', '#91a7ff', '#e599f7', '#ffa8a8',
];

function getRandomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export function CollaborativeEditor({ pageId, spaceSlug, editable = true, onEditorReady }: CollaborativeEditorProps) {
  const user = useAuthStore((s) => s.user);
  const { t } = useTranslation();
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [synced, setSynced] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'highlight' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use refs + state for Yjs/Hocuspocus to survive React Strict Mode double-mount.
  // `providerState` is tracked via useState so that changes trigger editor re-creation.
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const [providerState, setProviderState] = useState<HocuspocusProvider | null>(null);

  if (!ydocRef.current) {
    ydocRef.current = new Y.Doc();
  }

  useEffect(() => {
    const ydoc = ydocRef.current!;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234';
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : '';

    // Defer provider creation to the next macrotask. In React Strict Mode,
    // the first mount's cleanup runs synchronously before this timer fires,
    // so no provider is ever created for the throwaway mount cycle —
    // preventing unhandled WebSocket promise rejections during teardown.
    let provider: HocuspocusProvider | null = null;
    let destroyed = false;

    const timerId = setTimeout(() => {
      if (destroyed) return;

      provider = new HocuspocusProvider({
        url: wsUrl,
        name: `page:${pageId}`,
        document: ydoc,
        token,
        autoConnect: false,
        onConnect() { if (!destroyed) setStatus('connected'); },
        onClose() { if (!destroyed) setStatus('disconnected'); },
        onSynced() { if (!destroyed) setSynced(true); },
      } as any);

      // Monkeypatch connect() to silently catch unhandled rejections.
      // HocuspocusProvider's internal retry/reconnection logic
      // (onClose → setTimeout → this.connect()) creates promise chains
      // that aren't caught, rejecting with plain objects that show as
      // "[object Object]" in the Next.js dev overlay.
      const origConnect = provider.connect.bind(provider);
      (provider as any).connect = () => {
        const result = origConnect();
        if (result && typeof (result as any).catch === 'function') {
          (result as any).catch(() => { /* suppress WebSocket retry rejections */ });
        }
        return result;
      };

      provider.connect();
      providerRef.current = provider;
      setProviderState(provider);
    }, 0);

    return () => {
      destroyed = true;
      clearTimeout(timerId);
      if (provider) {
        provider.destroy();
      }
      providerRef.current = null;
      setProviderState(null);
      setSynced(false);
      setStatus('connecting');
    };
  }, [pageId]);

  const ydoc = ydocRef.current;
  const provider = providerState;

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editorRef.current) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post(`/pages/${pageId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Use permanent proxy URL instead of expiring signed URL.
      // GET /api/attachments/:id/file streams the file directly from S3 — no expiration.
      // Relative path works because Next.js rewrites /api/* to the backend.
      const permanentUrl = `/api/attachments/${data.id}/file`;
      editorRef.current.chain().focus().setImage({ src: permanentUrl, alt: file.name }).run();
    } catch {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        editorRef.current?.chain().focus().setImage({ src: result, alt: file.name }).run();
      };
      reader.readAsDataURL(file);
    }
  }, [pageId]);

  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          undoRedo: false,
          codeBlock: false,
        }),
        Placeholder.configure({
          placeholder: 'Start writing collaboratively...',
        }),
        ...(provider ? [
          Collaboration.configure({
            document: ydoc,
          }),
          CollaborationCaret.configure({
            provider,
            user: {
              name: user?.name || 'Anonymous',
              color: getRandomColor(),
            },
          }),
        ] : []),
        Table.configure({
          resizable: true,
          handleWidth: 5,
          cellMinWidth: 100,
          lastColumnResizable: true,
        }),
        TableRow,
        TableCell,
        TableHeader,
        ResizableImageExtension.configure({
          allowBase64: true,
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'editor-link',
          },
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Underline,
        Highlight.configure({
          multicolor: true,
        }),
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        TextStyle,
        Color,
        Superscript,
        Subscript,
        Typography,
        CharacterCount,
        CalloutExtension,
        CodeBlockExtension,
        SlashCommandExtension.configure({
          suggestion: {
            ...slashCommandSuggestion,
          },
        }),
        ...(spaceSlug ? [createMentionExtension(spaceSlug)] : []),
      ],
      editorProps: {
        attributes: {
          class: 'dokka-editor prose prose-sm dark:prose-invert max-w-none min-h-[calc(100vh-280px)] focus:outline-none px-4 py-3',
        },
        handleDrop: (_view, event, _slice, moved) => {
          if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
            const file = event.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
              event.preventDefault();
              handleImageUpload(file);
              return true;
            }
          }
          return false;
        },
        handlePaste: (_view, event) => {
          const items = event.clipboardData?.items;
          if (items) {
            for (let i = 0; i < items.length; i++) {
              if (items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile();
                if (file) {
                  event.preventDefault();
                  handleImageUpload(file);
                  return true;
                }
              }
            }
          }
          return false;
        },
      },
    },
    [ydoc, provider, synced],
  );

  // Sync editable state via useEffect (avoids flushSync-during-render error)
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Keep editor ref current and notify parent
  useEffect(() => {
    (editorRef as React.MutableRefObject<typeof editor>).current = editor;
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  const handleAddLink = useCallback(() => {
    if (!editor) return;
    if (linkUrl) {
      const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  const handleImageButton = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
    if (e.target) e.target.value = '';
  }, [handleImageUpload]);

  // Close popovers on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-color-picker]')) {
        setShowColorPicker(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!synced) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border p-12">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          {status === 'disconnected' ? (
            <>
              <WifiOff className="h-8 w-8" />
              <p className="text-sm">{t('editor.unableToConnect')}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatus('connecting');
                  provider?.connect();
                }}
              >
                {t('common.tryAgain')}
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">{t('editor.connecting')}</p>
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
    disabled,
  }: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
    disabled?: boolean;
  }) => (
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-8 w-8', isActive && 'bg-accent text-accent-foreground')}
      onClick={onClick}
      title={title}
      type="button"
      disabled={disabled}
    >
      {children}
    </Button>
  );

  const ToolbarDivider = () => <div className="mx-0.5 h-6 w-px bg-border" />;

  const charCount = editor.storage.characterCount;

  return (
    <div className="rounded-lg border border-border overflow-hidden flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 p-1 sticky top-0 z-10">
          {/* Text formatting */}
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title={t('editor.bold')}>
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title={t('editor.italic')}>
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title={t('editor.underline')}>
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title={t('editor.strikethrough')}>
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Headings */}
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title={t('editor.heading1')}>
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title={t('editor.heading2')}>
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title={t('editor.heading3')}>
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Lists */}
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title={t('editor.bulletList')}>
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title={t('editor.orderedList')}>
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive('taskList')} title={t('editor.taskList')}>
            <ListChecks className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Alignment */}
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title={t('editor.alignLeft')}>
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title={t('editor.alignCenter')}>
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title={t('editor.alignRight')}>
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })} title={t('editor.alignJustify')}>
            <AlignJustify className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Colors */}
          <div className="relative" data-color-picker>
            <ToolbarButton
              onClick={() => setShowColorPicker(showColorPicker === 'text' ? null : 'text')}
              title={t('editor.textColor')}
            >
              <Palette className="h-4 w-4" />
            </ToolbarButton>
            {showColorPicker === 'text' && (
              <div className="absolute top-full left-0 z-50 mt-1 grid grid-cols-4 gap-1 rounded-lg border border-border bg-popover p-2 shadow-md" data-color-picker>
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    className="h-6 w-6 rounded border border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      editor.chain().focus().setColor(color).run();
                      setShowColorPicker(null);
                    }}
                  />
                ))}
                <button
                  className="col-span-4 mt-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    editor.chain().focus().unsetColor().run();
                    setShowColorPicker(null);
                  }}
                >
                  {t('editor.resetColor')}
                </button>
              </div>
            )}
          </div>

          <div className="relative" data-color-picker>
            <ToolbarButton
              onClick={() => setShowColorPicker(showColorPicker === 'highlight' ? null : 'highlight')}
              isActive={editor.isActive('highlight')}
              title={t('editor.highlight')}
            >
              <Highlighter className="h-4 w-4" />
            </ToolbarButton>
            {showColorPicker === 'highlight' && (
              <div className="absolute top-full left-0 z-50 mt-1 grid grid-cols-4 gap-1 rounded-lg border border-border bg-popover p-2 shadow-md" data-color-picker>
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    key={color}
                    className="h-6 w-6 rounded border border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      editor.chain().focus().toggleHighlight({ color }).run();
                      setShowColorPicker(null);
                    }}
                  />
                ))}
                <button
                  className="col-span-4 mt-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    editor.chain().focus().unsetHighlight().run();
                    setShowColorPicker(null);
                  }}
                >
                  {t('editor.removeHighlight')}
                </button>
              </div>
            )}
          </div>

          <ToolbarButton onClick={() => editor.chain().focus().toggleSuperscript().run()} isActive={editor.isActive('superscript')} title={t('editor.superscript')}>
            <SuperscriptIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleSubscript().run()} isActive={editor.isActive('subscript')} title={t('editor.subscript')}>
            <SubscriptIcon className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Insert elements */}
          <div className="relative">
            <ToolbarButton
              onClick={() => {
                if (showLinkInput) {
                  setShowLinkInput(false);
                } else {
                  const existingUrl = editor.getAttributes('link').href || '';
                  setLinkUrl(existingUrl);
                  setShowLinkInput(true);
                }
              }}
              isActive={editor.isActive('link')}
              title={t('editor.link')}
            >
              <LinkIcon className="h-4 w-4" />
            </ToolbarButton>
            {showLinkInput && (
              <div className="absolute top-full left-0 z-50 mt-1 flex items-center gap-1 rounded-lg border border-border bg-popover p-2 shadow-md">
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                  placeholder="https://..."
                  className="h-7 w-48 rounded border border-input bg-background px-2 text-sm"
                  autoFocus
                />
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleAddLink}>
                  ✓
                </Button>
                {editor.isActive('link') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-destructive"
                    onClick={() => {
                      editor.chain().focus().unsetLink().run();
                      setShowLinkInput(false);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>

          <ToolbarButton onClick={handleImageButton} title={t('editor.insertImage')}>
            <ImagePlus className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            title={t('editor.insertTable')}
          >
            <TableIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title={t('editor.codeBlock')}>
            <Code className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title={t('editor.blockquote')}>
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title={t('editor.divider')}>
            <Minus className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title={t('editor.undo')}>
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title={t('editor.redo')}>
            <Redo className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          <EmojiPickerButton editor={editor} title={t('editor.emoji') || 'Emoji'} />

          {/* Connection status + character count */}
          <div className="ml-auto flex items-center gap-3 px-2">
            {charCount && (
              <span className="text-xs text-muted-foreground">
                {charCount.characters()} {t('common.characters')}
              </span>
            )}
            <div className="flex items-center gap-1">
              <div
                className={cn(
                  'h-2 w-2 rounded-full',
                  status === 'connected' ? 'bg-green-500' : status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500',
                )}
              />
              <span className="text-xs text-muted-foreground">
                {status === 'connected' ? t('editor.live') : status === 'connecting' ? t('editor.connectingStatus') : t('editor.offline')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Table context toolbar */}
      {editable && editor.isActive('table') && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-blue-50 dark:bg-blue-950/30 px-2 py-1">
          <span className="text-xs font-medium text-muted-foreground mr-2">{t('editor.table')}:</span>
          <ToolbarButton onClick={() => editor.chain().focus().addColumnBefore().run()} title={t('editor.addColumnBefore')}>
            <Plus className="h-3 w-3" /><Columns className="h-3 w-3" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title={t('editor.addColumnAfter')}>
            <Columns className="h-3 w-3" /><Plus className="h-3 w-3" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().addRowBefore().run()} title={t('editor.addRowBefore')}>
            <Plus className="h-3 w-3" /><Rows className="h-3 w-3" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title={t('editor.addRowAfter')}>
            <Rows className="h-3 w-3" /><Plus className="h-3 w-3" />
          </ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton onClick={() => editor.chain().focus().deleteColumn().run()} title={t('editor.deleteColumn')}>
            <Trash2 className="h-3 w-3 text-destructive" /><Columns className="h-3 w-3" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().deleteRow().run()} title={t('editor.deleteRow')}>
            <Trash2 className="h-3 w-3 text-destructive" /><Rows className="h-3 w-3" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title={t('editor.deleteTable')}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton onClick={() => editor.chain().focus().mergeCells().run()} title={t('editor.mergeCells')}>
            <span className="text-xs font-bold">M</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().splitCell().run()} title={t('editor.splitCell')}>
            <span className="text-xs font-bold">S</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeaderRow().run()} title={t('editor.toggleHeaderRow')}>
            <span className="text-xs font-bold">H</span>
          </ToolbarButton>
        </div>
      )}

      {/* Editor content */}
      <div className="relative flex-1">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
