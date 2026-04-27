'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { cn } from '@/lib/utils';
import type { SlashCommandItem } from './SlashCommandExtension';

interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export interface SlashCommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    // Reset index when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    // Scroll selected item into view
    useEffect(() => {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }, [selectedIndex]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command(item);
        }
      },
      [items, command],
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }

        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }

        if (event.key === 'Escape') {
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div
          className="slash-command-popup rounded-lg p-3"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--rule)',
            boxShadow: 'var(--pop-shadow)',
          }}
        >
          <p className="text-sm text-[color:var(--ink-3)]">No results found</p>
        </div>
      );
    }

    // Group items by category
    const grouped: Record<string, SlashCommandItem[]> = {};
    for (const item of items) {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    }

    let globalIndex = 0;

    return (
      <div
        ref={scrollRef}
        className="slash-command-popup z-50 max-h-80 w-80 overflow-y-auto rounded-lg p-1"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--rule)',
          boxShadow: 'var(--pop-shadow)',
        }}
      >
        {Object.entries(grouped).map(([category, categoryItems]) => (
          <div key={category}>
            <div
              className="sticky top-0 px-3 py-2 text-[10.5px] font-semibold uppercase"
              style={{
                background: 'var(--bg-elevated)',
                color: 'var(--ink-3)',
                letterSpacing: '0.08em',
              }}
            >
              {category}
            </div>
            {categoryItems.map((item) => {
              const currentIndex = globalIndex++;
              const Icon = item.icon;

              return (
                <button
                  key={item.title}
                  ref={(el) => {
                    itemRefs.current[currentIndex] = el;
                  }}
                  className={cn(
                    'wp-slash-item',
                    currentIndex === selectedIndex && 'is-selected',
                  )}
                  onClick={() => selectItem(currentIndex)}
                  onMouseEnter={() => setSelectedIndex(currentIndex)}
                >
                  <div className="wp-slash-item-icon">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="wp-slash-item-title truncate">{item.title}</div>
                    <div className="wp-slash-item-desc truncate">{item.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  },
);

SlashCommandList.displayName = 'SlashCommandList';
