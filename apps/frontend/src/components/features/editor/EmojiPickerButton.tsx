'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

const Picker = dynamic(() => import('@emoji-mart/react').then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="w-[352px] h-[435px] flex items-center justify-center bg-popover rounded-lg border border-border">
      <span className="text-muted-foreground text-sm">Loading...</span>
    </div>
  ),
});

interface EmojiPickerButtonProps {
  editor: any;
  title?: string;
}

export function EmojiPickerButton({ editor, title = 'Emoji' }: EmojiPickerButtonProps) {
  const [showPicker, setShowPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleEmojiSelect = useCallback(
    (emoji: any) => {
      if (editor && emoji.native) {
        editor.chain().focus().insertContent(emoji.native).run();
      }
      setShowPicker(false);
    },
    [editor],
  );

  // Close on click outside
  useEffect(() => {
    if (!showPicker) return;

    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  // Close on Escape
  useEffect(() => {
    if (!showPicker) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPicker(false);
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showPicker]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className={cn('h-8 w-8', showPicker && 'bg-accent text-accent-foreground')}
        onClick={() => setShowPicker(!showPicker)}
        title={title}
        type="button"
      >
        <Smile className="h-4 w-4" />
      </Button>
      {showPicker && (
        <div className="absolute top-full right-0 z-50 mt-1">
          <Picker
            onEmojiSelect={handleEmojiSelect}
            theme="auto"
            previewPosition="none"
            skinTonePosition="search"
            set="native"
            maxFrequentRows={2}
          />
        </div>
      )}
    </div>
  );
}
