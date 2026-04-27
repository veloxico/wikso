import { Node, mergeAttributes } from '@tiptap/react';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CalloutView } from './CalloutView';

export type CalloutType = 'info' | 'warning' | 'success' | 'error';

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { type?: CalloutType }) => ReturnType;
      toggleCallout: (attrs?: { type?: CalloutType }) => ReturnType;
    };
  }
}

export const CalloutExtension = Node.create({
  name: 'callout',

  group: 'block',

  content: 'block+',

  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'info' as CalloutType,
        parseHTML: (element) => element.getAttribute('data-callout-type') || 'info',
        renderHTML: (attributes) => ({
          'data-callout-type': attributes.type,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-callout]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // Emit `wp-callout` so non-React surfaces (HTML export, search-index
    // snippet rendering, plain-HTML preview iframes) match the editor's
    // visual treatment. The legacy `callout callout-{type}` class is
    // dropped because nothing reads it anymore — the React NodeView
    // re-wraps with `wp-callout` at mount, and the parser keys off
    // `div[data-callout]` rather than the class.
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-callout': '', class: 'wp-callout' }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attrs);
        },
      toggleCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attrs);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Backspace on empty first line exits callout
      Backspace: ({ editor }) => {
        const { $from } = editor.state.selection;
        const node = $from.node(-1);
        if (
          node?.type.name === 'callout' &&
          $from.parent.textContent === '' &&
          $from.index(-1) === 0
        ) {
          return editor.commands.lift(this.name);
        }
        return false;
      },
    };
  },
});
