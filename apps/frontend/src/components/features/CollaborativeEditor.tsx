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
import { MermaidExtension } from './editor/MermaidExtension';
import { ExcalidrawExtension } from './editor/ExcalidrawExtension';
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
  Palette, PenTool, GitBranch, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import { api } from '@/lib/api';

/**
 * Normalize ProseMirror JSON node type names from snake_case (as
 * produced by the Confluence converter) to the camelCase names
 * expected by TipTap extensions (e.g. table_row → tableRow).
 */
const NODE_TYPE_MAP: Record<string, string> = {
  bullet_list: 'bulletList',
  code_block: 'codeBlock',
  hard_break: 'hardBreak',
  horizontal_rule: 'horizontalRule',
  list_item: 'listItem',
  ordered_list: 'orderedList',
  table_row: 'tableRow',
  table_cell: 'tableCell',
  table_header: 'tableHeader',
  task_list: 'taskList',
  task_item: 'taskItem',
  mermaid_diagram: 'mermaidDiagram',
  excalidraw_block: 'excalidrawBlock',
};

function normalizeNodeTypes(node: any): any {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(normalizeNodeTypes);
  const out: any = { ...node };
  if (out.type && NODE_TYPE_MAP[out.type]) {
    out.type = NODE_TYPE_MAP[out.type];
  }
  if (out.content) out.content = normalizeNodeTypes(out.content);
  if (out.marks) out.marks = out.marks.map((m: any) => {
    const nm: any = { ...m };
    if (nm.type && NODE_TYPE_MAP[nm.type]) nm.type = NODE_TYPE_MAP[nm.type];
    return nm;
  });
  return out;
}

interface CollaborativeEditorProps {
  pageId: string;
  spaceSlug?: string;
  editable?: boolean;
  onEditorReady?: (editor: any) => void;
  /** Pre-loaded page content (avoids extra API call for imported pages). */
  initialContent?: Record<string, unknown> | null;
  /** Called when editor content changes (useful for unsaved-changes tracking). */
  onContentChange?: () => void;
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

export function CollaborativeEditor({ pageId, spaceSlug, editable = true, onEditorReady, initialContent, onContentChange }: CollaborativeEditorProps) {
  const user = useAuthStore((s) => s.user);
  const { t } = useTranslation();
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [synced, setSynced] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'highlight' | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'editing' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  // A fresh Y.Doc is created for each pageId so old page content
  // never bleeds into a different page when navigating.
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const [providerState, setProviderState] = useState<HocuspocusProvider | null>(null);
  const [ydoc, setYdoc] = useState<Y.Doc>(() => new Y.Doc());

  useEffect(() => {
    // Create a fresh Y.Doc for each page.
    const newDoc = new Y.Doc();
    setYdoc(newDoc);

    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : '';

    // Fetch the WebSocket URL from the runtime config endpoint.
    // NEXT_PUBLIC_WS_URL is a build-time variable and won't be set in
    // pre-built Docker images, so we resolve the URL at runtime instead.
    let provider: HocuspocusProvider | null = null;
    let destroyed = false;
    let syncedFlag = false;
    let syncFallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const initProvider = async () => {
      if (destroyed) return;

      let wsUrl: string;
      try {
        const res = await fetch('/api/client-config');
        const cfg = await res.json();
        wsUrl = cfg.wsUrl;
      } catch {
        // Fallback for local development without the config endpoint
        wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234';
      }

      if (destroyed) return;

      provider = new HocuspocusProvider({
        url: wsUrl,
        name: `page:${pageId}`,
        document: newDoc,
        token,
        autoConnect: false,
        onConnect() {
          if (!destroyed) {
            setStatus('connected');
          }
        },
        onClose() { if (!destroyed) setStatus('disconnected'); },
        onSynced() {
          if (!destroyed) {
            syncedFlag = true;
            setSynced(true);
            if (syncFallbackTimer) { clearTimeout(syncFallbackTimer); syncFallbackTimer = null; }
          }
        },
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

      // Fallback: if onSynced doesn't fire (e.g. imported page with no
      // yjsState), force synced state so the editor can load contentJson.
      // Start timer immediately — don't wait for onConnect.
      syncFallbackTimer = setTimeout(() => {
        if (!destroyed && !syncedFlag) {
          syncedFlag = true;
          setSynced(true);
        }
      }, 500);
    };

    // Defer to next macrotask — in React Strict Mode the first mount's
    // cleanup runs synchronously, so the async function won't proceed
    // past the first `if (destroyed)` check for the throwaway cycle.
    const timerId = setTimeout(initProvider, 0);

    return () => {
      destroyed = true;
      clearTimeout(timerId);
      if (syncFallbackTimer) clearTimeout(syncFallbackTimer);
      if (provider) {
        provider.destroy();
      }
      providerRef.current = null;
      setProviderState(null);
      newDoc.destroy();
      setSynced(false);
      setStatus('connecting');
    };
  }, [pageId]);

  const provider = providerState;

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editorRef.current) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post(`/pages/${pageId}/attachments`, formData);
      // Use permanent proxy URL instead of expiring signed URL.
      // GET /api/v1/attachments/:id/file streams the file directly from S3 — no expiration.
      // Relative path works because Next.js rewrites /api/* to the backend.
      const permanentUrl = `/api/v1/attachments/${data.id}/file`;
      editorRef.current.chain().focus().setImage({ src: permanentUrl, alt: file.name }).run();
    } catch {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        editorRef.current?.chain().focus().setImage({ src: result, alt: file.name }).run();
      };
      reader.onerror = () => {
        console.error('Failed to read image file:', file.name);
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
        MermaidExtension,
        ExcalidrawExtension,
        SlashCommandExtension.configure({
          suggestion: {
            ...slashCommandSuggestion,
          },
        }),
        ...(spaceSlug ? [createMentionExtension(spaceSlug)] : []),
      ],
      editorProps: {
        attributes: {
          class: 'wikso-editor prose prose-sm dark:prose-invert max-w-none min-h-[calc(100vh-280px)] focus:outline-none px-4 py-3',
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
      onUpdate: () => {
        onContentChangeRef.current?.();
      },
    },
    [ydoc, provider, synced],
  );

  // After first sync, if the Y.Doc is empty (imported page with no yjsState),
  // initialize the editor from the pre-loaded contentJson using setContent.
  const contentLoadedRef = useRef(false);
  useEffect(() => {
    if (!editor || !synced || contentLoadedRef.current) return;
    if (editor.isDestroyed) return;

    const fragment = ydoc.getXmlFragment('default');
    if (fragment.length > 0) {
      contentLoadedRef.current = true;
      return;
    }

    contentLoadedRef.current = true;

    const loadContent = async () => {
      try {
        let json = initialContent;
        if (!json) {
          const { data } = await api.get(`/spaces/${spaceSlug}/pages/${pageId}`);
          json = data?.contentJson ?? null;
        }
        if (json && editor && !editor.isDestroyed) {
          const parsed = typeof json === 'string' ? JSON.parse(json) : json;
          if (parsed?.content?.length > 0) {
            const normalized = normalizeNodeTypes(parsed);
            editor.commands.setContent(normalized);
          }
        }
      } catch (err) {
        console.warn('Failed to load contentJson for fresh page:', err);
      }
    };

    loadContent();
  }, [editor, synced, ydoc, pageId, spaceSlug, initialContent]);

  // Reset contentLoadedRef when page changes
  useEffect(() => {
    contentLoadedRef.current = false;
  }, [pageId]);

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

  // Save status indicator: track editing → saved transitions
  useEffect(() => {
    if (!editor || !editable) return;
    const handler = () => {
      setSaveStatus('editing');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        setSaveStatus('saved');
        // Auto-reset to idle after 3 seconds
        setTimeout(() => setSaveStatus('idle'), 3000);
      }, 1500);
    };
    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [editor, editable]);

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
      onMouseDown={(e) => e.preventDefault()}
      title={title}
      type="button"
      disabled={disabled}
    >
      {children}
    </Button>
  );

  const ToolbarDivider = () => <div className="mx-0.5 h-6 w-px bg-border" />;

  /** Build a tooltip string with optional keyboard shortcut */
  const tip = (label: string, shortcut?: string) => {
    if (!shortcut) return label;
    // Detect Mac — show ⌘ instead of Ctrl
    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const formatted = shortcut
      .replace('Ctrl', isMac ? '⌘' : 'Ctrl')
      .replace('Shift', isMac ? '⇧' : 'Shift')
      .replace('Alt', isMac ? '⌥' : 'Alt');
    return `${label} (${formatted})`;
  };

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
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title={tip(t('editor.bold'), 'Ctrl+B')}>
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title={tip(t('editor.italic'), 'Ctrl+I')}>
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title={tip(t('editor.underline'), 'Ctrl+U')}>
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title={tip(t('editor.strikethrough'), 'Ctrl+Shift+X')}>
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Headings */}
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title={tip(t('editor.heading1'), 'Ctrl+Alt+1')}>
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title={tip(t('editor.heading2'), 'Ctrl+Alt+2')}>
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title={tip(t('editor.heading3'), 'Ctrl+Alt+3')}>
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Lists */}
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title={tip(t('editor.bulletList'), 'Ctrl+Shift+8')}>
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title={tip(t('editor.orderedList'), 'Ctrl+Shift+7')}>
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive('taskList')} title={tip(t('editor.taskList'), 'Ctrl+Shift+9')}>
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
              title={tip(t('editor.link'), 'Ctrl+K')}
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
          <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title={tip(t('editor.codeBlock'), 'Ctrl+Alt+C')}>
            <Code className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title={tip(t('editor.blockquote'), 'Ctrl+Shift+B')}>
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title={t('editor.divider')}>
            <Minus className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton onClick={() => editor.chain().focus().setExcalidrawBlock().run()} title={t('editor.drawing')}>
            <PenTool className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setMermaidDiagram().run()} title={t('editor.mermaidDiagram')}>
            <GitBranch className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title={tip(t('editor.undo'), 'Ctrl+Z')}>
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title={tip(t('editor.redo'), 'Ctrl+Shift+Z')}>
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
            {editable && saveStatus !== 'idle' && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {saveStatus === 'editing' && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t('editor.syncing')}
                  </>
                )}
                {saveStatus === 'saved' && (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    {t('editor.changesSaved')}
                  </>
                )}
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
