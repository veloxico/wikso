import { Node, mergeAttributes } from '@tiptap/react';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { MermaidNodeView } from './MermaidNodeView';

export const DEFAULT_MERMAID_EXAMPLE = 'flowchart LR\n  A[Start] --> B[End]';

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    mermaidBlock: {
      /** Insert a new Mermaid diagram block with an optional initial code value. */
      setMermaidBlock: (attrs?: { code?: string }) => ReturnType;
    };
  }
}

/**
 * TipTap Node extension for live-rendered Mermaid diagrams.
 *
 * The source code lives in the `code` attribute, so the block is a single atomic
 * unit from ProseMirror's perspective (draggable/deletable as one), but the
 * underlying text is serialised in the document JSON/HTML and survives version
 * history and Yjs sync unchanged.
 *
 * The node renders as `<pre data-type="mermaid">{code}</pre>` in HTML, which
 * keeps it reasonable in exports and makes it trivially round-trippable via
 * `parseHTML`. The React NodeView is attached for in-editor interactivity.
 */
export const MermaidBlock = Node.create({
  name: 'mermaidBlock',

  group: 'block',

  // Non-atomic so the NodeView has stable focus/selection semantics, but the
  // content model is empty — the diagram source is stored as an attribute,
  // not as text children.
  atom: false,
  defining: true,
  isolating: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      code: {
        default: DEFAULT_MERMAID_EXAMPLE,
        parseHTML: (element) => {
          // Prefer data-code for round-tripping; fall back to text content of <pre>.
          const attr = element.getAttribute('data-code');
          if (attr !== null) return attr;
          return element.textContent || DEFAULT_MERMAID_EXAMPLE;
        },
        renderHTML: (attributes) => {
          if (!attributes.code) return {};
          return { 'data-code': attributes.code as string };
        },
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'pre[data-type="mermaid"]' },
      { tag: 'div[data-type="mermaid-block"]' },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const code = (node.attrs.code as string) ?? '';
    return [
      'pre',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'mermaid',
        class: 'mermaid-block-serialized',
      }),
      code,
    ];
  },

  addCommands() {
    return {
      setMermaidBlock:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              code: attrs?.code ?? DEFAULT_MERMAID_EXAMPLE,
            },
          }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView);
  },
});

export default MermaidBlock;
