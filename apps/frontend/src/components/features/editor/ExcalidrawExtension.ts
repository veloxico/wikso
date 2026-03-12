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
    return ReactNodeViewRenderer(ExcalidrawView);
  },
});
