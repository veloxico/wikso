import { Node, mergeAttributes } from '@tiptap/react';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { MermaidView } from './MermaidView';

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    mermaidDiagram: {
      setMermaidDiagram: (attrs?: { code?: string }) => ReturnType;
    };
  }
}

export const MermaidExtension = Node.create({
  name: 'mermaidDiagram',

  group: 'block',

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      code: {
        default: 'graph TD\n  A[Start] --> B[End]',
        parseHTML: (element) => element.getAttribute('data-code') || 'graph TD\n  A[Start] --> B[End]',
        renderHTML: (attributes) => ({
          'data-code': attributes.code,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="mermaid-diagram"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'mermaid-diagram',
        class: 'mermaid-block',
      }),
    ];
  },

  addCommands() {
    return {
      setMermaidDiagram:
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
    return ReactNodeViewRenderer(MermaidView);
  },
});
