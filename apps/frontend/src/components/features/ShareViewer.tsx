'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
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
import { ResizableImageExtension } from './editor/ResizableImageExtension';
import { CalloutExtension } from './editor/CalloutExtension';
import { CodeBlockExtension } from './editor/CodeBlockExtension';
import { MermaidExtension } from './editor/MermaidExtension';
import { ExcalidrawExtension } from './editor/ExcalidrawExtension';
import { useEffect } from 'react';

interface ShareViewerProps {
  content: Record<string, unknown> | null | undefined;
}

/**
 * Read-only TipTap mount for the public share page.
 *
 * Deliberately minimal — no toolbar, no slash menu, no mentions, no collab.
 * Only the extensions needed to render the content correctly. Editable is
 * hard-wired to `false`; we also strip any accidental keyboard shortcuts.
 */
export function ShareViewer({ content }: ShareViewerProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      ResizableImageExtension.configure({ allowBase64: true }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: { class: 'editor-link', rel: 'noopener noreferrer', target: '_blank' },
      }),
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
      CalloutExtension,
      CodeBlockExtension,
      MermaidExtension,
      ExcalidrawExtension,
    ],
    content: content || '',
    editorProps: {
      attributes: {
        class: 'wikso-editor wikso-share-viewer prose prose-neutral dark:prose-invert max-w-none focus:outline-none',
      },
    },
  });

  // If the parent hot-swaps content (unlikely on a public share, but cheap to
  // handle), re-set the doc so the viewer stays in sync.
  useEffect(() => {
    if (editor && content) {
      editor.commands.setContent(content as never, { emitUpdate: false });
    }
  }, [editor, content]);

  return <EditorContent editor={editor} />;
}
