import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { all, createLowlight } from 'lowlight';

// Create lowlight instance with all languages
const lowlight = createLowlight(all);

export const CodeBlockExtension = CodeBlockLowlight.configure({
  lowlight,
  defaultLanguage: 'plaintext',
  HTMLAttributes: {
    class: 'code-block',
  },
});
