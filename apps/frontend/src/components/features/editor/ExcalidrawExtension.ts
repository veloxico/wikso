import { Node, mergeAttributes } from '@tiptap/react';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ExcalidrawView } from './ExcalidrawView';

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    excalidrawBlock: {
      setExcalidrawBlock: (attrs?: { data?: string }) => ReturnType;
    };
  }
}

export const ExcalidrawExtension = Node.create({
  name: 'excalidrawBlock',

  group: 'block',

  atom: true,

  draggable: true,

  selectable: true,

  addAttributes() {
    return {
      data: {
        default: '{}',
        parseHTML: (element) => element.getAttribute('data-excalidraw') || '{}',
        renderHTML: (attributes) => ({
          'data-excalidraw': attributes.data,
        }),
      },
      previewSvg: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-preview-svg') || '',
        renderHTML: (attributes) => {
          if (!attributes.previewSvg) return {};
          return { 'data-preview-svg': attributes.previewSvg };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="excalidraw-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'excalidraw-block',
        class: 'excalidraw-block',
      }),
    ];
  },

  addCommands() {
    return {
      setExcalidrawBlock:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ExcalidrawView, {
      // Override TipTap's default stopEvent to prevent ProseMirror from
      // intercepting pointer/mouse/touch events inside the Excalidraw canvas.
      // Only events originating from [data-drag-handle] are passed through
      // to ProseMirror (for node dragging).
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement;

        // Let ProseMirror handle events on the drag handle
        if (target.closest?.('[data-drag-handle]')) {
          return false;
        }

        // Let copy/paste/cut through to ProseMirror
        if (['copy', 'paste', 'cut'].includes(event.type)) {
          return false;
        }

        // Block all pointer/mouse/touch/drag events from ProseMirror
        // so Excalidraw's internal canvas handlers work freely
        if (
          event.type.startsWith('mouse') ||
          event.type.startsWith('pointer') ||
          event.type.startsWith('touch') ||
          event.type.startsWith('drag') ||
          event.type === 'drop' ||
          event.type === 'wheel'
        ) {
          return true;
        }

        // Block keyboard events too (Excalidraw uses shortcuts)
        if (event.type.startsWith('key')) {
          return true;
        }

        return true;
      },
    });
  },
});
