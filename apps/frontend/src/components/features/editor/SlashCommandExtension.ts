import { Extension } from '@tiptap/react';
import { Suggestion, SuggestionOptions } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Table,
  Image,
  Code,
  Quote,
  Minus,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  GitBranch,
  PenTool,
  type LucideIcon,
} from 'lucide-react';

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: LucideIcon;
  command: (props: { editor: any; range: any }) => void;
  category: string;
  aliases?: string[];
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: Heading1,
    category: 'Headings',
    aliases: ['h1', 'heading1'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: Heading2,
    category: 'Headings',
    aliases: ['h2', 'heading2'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: Heading3,
    category: 'Headings',
    aliases: ['h3', 'heading3'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
    },
  },
  {
    title: 'Bullet List',
    description: 'Unordered list of items',
    icon: List,
    category: 'Lists',
    aliases: ['ul', 'unordered', 'bullets'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Numbered List',
    description: 'Ordered list with numbers',
    icon: ListOrdered,
    category: 'Lists',
    aliases: ['ol', 'ordered', 'numbered'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Task List',
    description: 'Checklist with checkboxes',
    icon: ListChecks,
    category: 'Lists',
    aliases: ['todo', 'checklist', 'tasks'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: 'Table',
    description: 'Insert a 3×3 table',
    icon: Table,
    category: 'Insert',
    aliases: ['grid'],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    title: 'Image',
    description: 'Upload or embed an image',
    icon: Image,
    category: 'Insert',
    aliases: ['img', 'picture', 'photo'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      // Trigger file input after slash command
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const src = e.target?.result as string;
            editor.chain().focus().setImage({ src, alt: file.name }).run();
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    },
  },
  {
    title: 'Code Block',
    description: 'Code snippet with syntax highlighting',
    icon: Code,
    category: 'Insert',
    aliases: ['code', 'pre', 'snippet'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: 'Blockquote',
    description: 'Highlight a quote or excerpt',
    icon: Quote,
    category: 'Insert',
    aliases: ['quote', 'cite'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: 'Divider',
    description: 'Horizontal line separator',
    icon: Minus,
    category: 'Insert',
    aliases: ['hr', 'separator', 'line'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: 'Info Callout',
    description: 'Blue info panel for notes',
    icon: Info,
    category: 'Callout',
    aliases: ['callout', 'note', 'info', 'panel'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout({ type: 'info' }).run();
    },
  },
  {
    title: 'Warning Callout',
    description: 'Yellow warning panel',
    icon: AlertTriangle,
    category: 'Callout',
    aliases: ['warning', 'caution', 'alert'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout({ type: 'warning' }).run();
    },
  },
  {
    title: 'Success Callout',
    description: 'Green success panel',
    icon: CheckCircle,
    category: 'Callout',
    aliases: ['success', 'tip', 'done'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout({ type: 'success' }).run();
    },
  },
  {
    title: 'Error Callout',
    description: 'Red error/danger panel',
    icon: XCircle,
    category: 'Callout',
    aliases: ['error', 'danger', 'critical'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout({ type: 'error' }).run();
    },
  },
  {
    title: 'Mermaid Diagram',
    description: 'Flowchart, sequence, or other diagram',
    icon: GitBranch,
    category: 'Insert',
    aliases: ['mermaid', 'diagram', 'flowchart', 'chart', 'sequence', 'gantt'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent({ type: 'mermaidDiagram' }).run();
    },
  },
  {
    title: 'Drawing',
    description: 'Excalidraw whiteboard',
    icon: PenTool,
    category: 'Insert',
    aliases: ['draw', 'excalidraw', 'whiteboard', 'sketch', 'canvas'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent({ type: 'excalidrawBlock' }).run();
    },
  },
];

export const SlashCommandPluginKey = new PluginKey('slashCommand');

export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        pluginKey: SlashCommandPluginKey,
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range });
        },
        items: ({ query }: { query: string }): SlashCommandItem[] => {
          const q = query.toLowerCase();
          if (!q) return SLASH_COMMANDS;

          return SLASH_COMMANDS.filter((item) => {
            return (
              item.title.toLowerCase().includes(q) ||
              item.description.toLowerCase().includes(q) ||
              item.category.toLowerCase().includes(q) ||
              item.aliases?.some((a) => a.includes(q))
            );
          });
        },
      } as Partial<SuggestionOptions>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
