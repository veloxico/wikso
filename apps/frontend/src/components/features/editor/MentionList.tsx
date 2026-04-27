'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
} from 'react';
import { type SuggestionKeyDownProps } from '@tiptap/suggestion';
import { avatarStyle, initialsFor } from '@/lib/avatarColor';
import type { MentionUser } from './MentionExtension';

export interface MentionListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

interface MentionListProps {
  items: MentionUser[];
  command: (item: { id: string; label: string }) => void;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command({ id: item.id, label: item.name });
        }
      },
      [items, command],
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          selectItem(selectedIndex);
          return true;
        }

        return false;
      },
    }));

    if (!items.length) {
      return (
        <div className="mention-list-empty">
          No members found
        </div>
      );
    }

    return (
      <div className="mention-list">
        {items.map((item, index) => (
          <button
            key={item.id}
            className={`mention-list-item ${index === selectedIndex ? 'is-selected' : ''}`}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
            type="button"
          >
            <div
              className="mention-avatar"
              style={item.avatarUrl ? undefined : avatarStyle(item.name)}
            >
              {item.avatarUrl ? (
                <img src={item.avatarUrl} alt={item.name} />
              ) : (
                <span>{initialsFor(item.name)}</span>
              )}
            </div>
            <div className="mention-info">
              <span className="mention-name">{item.name}</span>
              <span className="mention-email">{item.email}</span>
            </div>
          </button>
        ))}
      </div>
    );
  },
);

MentionList.displayName = 'MentionList';
