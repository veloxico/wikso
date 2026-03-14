'use client';

import { useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToggleReaction } from '@/hooks/useComments';
import type { CommentReaction } from '@/types';

const REACTION_EMOJIS = ['👍', '👎', '❤️', '🎉', '🚀', '👀', '😄', '🤔'];

interface CommentReactionsProps {
  reactions: CommentReaction[];
  commentId: string;
  pageId: string;
  currentUserId?: string;
}

export function CommentReactions({ reactions, commentId, pageId, currentUserId }: CommentReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const toggleReaction = useToggleReaction(pageId);

  // Group reactions by emoji
  const grouped = (reactions || []).reduce<Record<string, { count: number; userReacted: boolean; users: string[] }>>(
    (acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = { count: 0, userReacted: false, users: [] };
      acc[r.emoji].count++;
      if (r.userId === currentUserId) acc[r.emoji].userReacted = true;
      if (r.user?.name) acc[r.emoji].users.push(r.user.name);
      return acc;
    },
    {},
  );

  const handleToggle = (emoji: string) => {
    toggleReaction.mutate({ commentId, emoji });
    setShowPicker(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {Object.entries(grouped).map(([emoji, data]) => (
        <button
          key={emoji}
          onClick={() => handleToggle(emoji)}
          title={data.users.join(', ')}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors hover:bg-muted',
            data.userReacted
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border bg-background text-muted-foreground',
          )}
        >
          <span>{emoji}</span>
          <span>{data.count}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          title="Add reaction"
        >
          <SmilePlus className="h-3 w-3" />
        </button>

        {showPicker && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
            <div className="absolute bottom-full left-0 z-50 mb-1 flex gap-1 rounded-lg border border-border bg-popover p-1.5 shadow-md">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleToggle(emoji)}
                  className="rounded p-1 text-base transition-colors hover:bg-muted"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
