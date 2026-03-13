'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
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
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, ListChecks,
  Heading1, Heading2, Heading3,
  Code, Quote, Minus,
  Undo, Redo,
  Table as TableIcon, ImagePlus, Link as LinkIcon,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Highlighter, Superscript as SuperscriptIcon, Subscript as SubscriptIcon,
  Trash2, Plus, Columns, Rows, Palette, PenTool, GitBranch,
} from 'lucide-react';
import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';

interface EditorProps {
  content?: Record<string, unknown>;
  onChange?: (json: Record<string, unknown>) => void;
  editable?: boolean;
  spaceSlug?: string;
}

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

export function Editor({ content, onChange, editable = true, spaceSlug }: EditorProps) {
  const { t } = useTranslation();
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'highlight' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({
        placeholder: t('editor.placeholder'),
      }),
      Table.configure({ resizable: true, handleWidth: 5, cellMinWidth: 100 }),
      TableRow,
      TableCell,
      TableHeader,
      ResizableImageExtension.configure({ allowBase64: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'editor-link' } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
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
    content: content || '',
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON() as Record<string, unknown>);
    },
    editorProps: {
      attributes: {
        class: 'wikso-editor prose prose-sm dark:prose-invert max-w-none min-h-[400px] focus:outline-none px-4 py-3',
      },
    },
  });

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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/') && editor) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        editor.chain().focus().setImage({ src: result, alt: file.name }).run();
      };
      reader.onerror = () => {
        console.error('Failed to read image file:', file.name);
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  }, [editor]);

  if (!editor) return null;

  const ToolbarButton = ({
    onClick, isActive, children, title, disabled,
  }: {
    onClick: () => void; isActive?: boolean; children: React.ReactNode; title: string; disabled?: boolean;
  }) => (
    <Button variant="ghost" size="icon" className={cn('h-8 w-8', isActive && 'bg-accent text-accent-foreground')} onClick={onClick} onMouseDown={(e) => e.preventDefault()} title={title} type="button" disabled={disabled}>
      {children}
    </Button>
  );

  const ToolbarDivider = () => <div className="mx-0.5 h-6 w-px bg-border" />;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 p-1">
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

          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title={t('editor.alignLeft')}>
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title={t('editor.alignCenter')}>
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title={t('editor.alignRight')}>
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          <div className="relative" data-color-picker>
            <ToolbarButton onClick={() => setShowColorPicker(showColorPicker === 'text' ? null : 'text')} title={t('editor.textColor')}>
              <Palette className="h-4 w-4" />
            </ToolbarButton>
            {showColorPicker === 'text' && (
              <div className="absolute top-full left-0 z-50 mt-1 grid grid-cols-4 gap-1 rounded-lg border border-border bg-popover p-2 shadow-md" data-color-picker>
                {TEXT_COLORS.map((color) => (
                  <button key={color} className="h-6 w-6 rounded border border-border hover:scale-110 transition-transform" style={{ backgroundColor: color }} onClick={() => { editor.chain().focus().setColor(color).run(); setShowColorPicker(null); }} />
                ))}
                <button className="col-span-4 mt-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => { editor.chain().focus().unsetColor().run(); setShowColorPicker(null); }}>{t('editor.resetColor')}</button>
              </div>
            )}
          </div>

          <div className="relative" data-color-picker>
            <ToolbarButton onClick={() => setShowColorPicker(showColorPicker === 'highlight' ? null : 'highlight')} isActive={editor.isActive('highlight')} title={t('editor.highlight')}>
              <Highlighter className="h-4 w-4" />
            </ToolbarButton>
            {showColorPicker === 'highlight' && (
              <div className="absolute top-full left-0 z-50 mt-1 grid grid-cols-4 gap-1 rounded-lg border border-border bg-popover p-2 shadow-md" data-color-picker>
                {HIGHLIGHT_COLORS.map((color) => (
                  <button key={color} className="h-6 w-6 rounded border border-border hover:scale-110 transition-transform" style={{ backgroundColor: color }} onClick={() => { editor.chain().focus().toggleHighlight({ color }).run(); setShowColorPicker(null); }} />
                ))}
                <button className="col-span-4 mt-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => { editor.chain().focus().unsetHighlight().run(); setShowColorPicker(null); }}>{t('editor.removeHighlight')}</button>
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

          <div className="relative">
            <ToolbarButton
              onClick={() => {
                if (showLinkInput) { setShowLinkInput(false); } else {
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
                <input type="text" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddLink()} placeholder="https://..." className="h-7 w-48 rounded border border-input bg-background px-2 text-sm" autoFocus />
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleAddLink}>✓</Button>
                {editor.isActive('link') && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => { editor.chain().focus().unsetLink().run(); setShowLinkInput(false); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>

          <ToolbarButton onClick={() => fileInputRef.current?.click()} title={t('editor.insertImage')}>
            <ImagePlus className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title={t('editor.insertTable')}>
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

          <ToolbarButton onClick={() => editor.chain().focus().setExcalidrawBlock().run()} title={t('editor.drawing')}>
            <PenTool className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setMermaidDiagram().run()} title={t('editor.mermaidDiagram')}>
            <GitBranch className="h-4 w-4" />
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

      <div className="relative">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
