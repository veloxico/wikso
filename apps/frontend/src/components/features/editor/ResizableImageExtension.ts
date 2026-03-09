import { Node, mergeAttributes } from '@tiptap/react';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ResizableImageView } from './ResizableImageView';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface ResizableImageOptions {
  allowBase64: boolean;
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    resizableImage: {
      setImage: (options: {
        src: string;
        alt?: string;
        title?: string;
        width?: number | string;
        alignment?: string;
        caption?: string;
      }) => ReturnType;
    };
  }
}

export const ResizableImageExtension = Node.create<ResizableImageOptions>({
  name: 'image',

  addOptions() {
    return {
      allowBase64: true,
      HTMLAttributes: {},
    };
  },

  group: 'block',

  draggable: true,

  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const img = element.querySelector('img') || element;
          return img.getAttribute('width') || img.style?.width || null;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
      alignment: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-alignment') || 'center',
        renderHTML: (attributes) => ({
          'data-alignment': attributes.alignment || 'center',
        }),
      },
      caption: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-caption') || '',
        renderHTML: (attributes) => {
          if (!attributes.caption) return {};
          return { 'data-caption': attributes.caption };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-type="resizable-image"]',
      },
      {
        tag: 'img[src]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'figure',
      mergeAttributes(this.options.HTMLAttributes, { 'data-type': 'resizable-image' }),
      [
        'img',
        mergeAttributes(HTMLAttributes, {
          class: 'editor-image',
        }),
      ],
    ];
  },

  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('resizableImageDrop'),
        props: {
          handleDOMEvents: {
            drop: (_view, event) => {
              const hasFiles =
                event.dataTransfer &&
                event.dataTransfer.files &&
                event.dataTransfer.files.length;

              if (!hasFiles) return false;

              const images = Array.from(event.dataTransfer.files).filter((file) =>
                file.type.startsWith('image/'),
              );

              if (images.length === 0) return false;

              // Let the editor's handleDrop take care of it
              return false;
            },
          },
        },
      }),
    ];
  },
});
