import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance } from 'tippy.js';
import { SlashCommandList, type SlashCommandListRef } from './SlashCommandList';
import type { SuggestionOptions, SuggestionKeyDownProps } from '@tiptap/suggestion';

export const slashCommandSuggestion: Omit<SuggestionOptions, 'editor'> = {
  render: () => {
    let reactRenderer: ReactRenderer<SlashCommandListRef> | null = null;
    let popup: Instance[] | null = null;

    return {
      onStart: (props) => {
        reactRenderer = new ReactRenderer(SlashCommandList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) return;

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: reactRenderer.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          maxWidth: 'none',
        });
      },

      onUpdate: (props) => {
        reactRenderer?.updateProps(props);

        if (!props.clientRect) return;

        popup?.[0]?.setProps({
          getReferenceClientRect: props.clientRect as () => DOMRect,
        });
      },

      onKeyDown: (props: SuggestionKeyDownProps) => {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide();
          return true;
        }

        return reactRenderer?.ref?.onKeyDown(props) ?? false;
      },

      onExit: () => {
        popup?.[0]?.destroy();
        reactRenderer?.destroy();
      },
    };
  },
};
