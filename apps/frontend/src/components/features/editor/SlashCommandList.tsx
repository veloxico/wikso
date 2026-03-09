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
        <div className="slash-command-popup rounded-lg border border-border bg-popover p-3 shadow-lg">
          <p className="text-sm text-muted-foreground">No results found</p>
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
        className="slash-command-popup z-50 max-h-80 w-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
      >
        {Object.entries(grouped).map(([category, categoryItems]) => (
          <div key={category}>
            <div className="sticky top-0 bg-popover/95 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50">
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
                    'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                    currentIndex === selectedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50',
                  )}
                  onClick={() => selectItem(currentIndex)}
                  onMouseEnter={() => setSelectedIndex(currentIndex)}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.description}
                    </p>
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
