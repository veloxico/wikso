import { Mention } from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import { type SuggestionOptions, type SuggestionKeyDownProps } from '@tiptap/suggestion';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { MentionList, type MentionListRef } from './MentionList';

export interface MentionUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export function createMentionExtension(spaceSlug: string) {
  return Mention.configure({
    HTMLAttributes: {
      class: 'mention',
    },
    suggestion: {
      char: '@',
      allowSpaces: true,
      items: async ({ query }: { query: string }): Promise<MentionUser[]> => {
        try {
          const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : '';
          const res = await fetch(
            `/api/v1/spaces/${spaceSlug}/members/search?q=${encodeURIComponent(query)}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );
          if (!res.ok) return [];
          return await res.json();
        } catch {
          return [];
        }
      },
      render: () => {
        let component: ReactRenderer<MentionListRef> | null = null;
        let popup: TippyInstance[] | null = null;

        return {
          onStart: (props: any) => {
            component = new ReactRenderer(MentionList, {
              props,
              editor: props.editor,
            });

            if (!props.clientRect) return;

            popup = tippy('body', {
              getReferenceClientRect: props.clientRect,
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: 'manual',
              placement: 'bottom-start',
              maxWidth: 320,
            });
          },
          onUpdate: (props: any) => {
            component?.updateProps(props);
            if (popup && props.clientRect) {
              popup[0]?.setProps({
                getReferenceClientRect: props.clientRect,
              });
            }
          },
          onKeyDown: (props: SuggestionKeyDownProps) => {
            if (props.event.key === 'Escape') {
              popup?.[0]?.hide();
              return true;
            }
            return component?.ref?.onKeyDown(props) ?? false;
          },
          onExit: () => {
            popup?.[0]?.destroy();
            component?.destroy();
          },
        };
      },
    } as Partial<SuggestionOptions>,
  });
}
