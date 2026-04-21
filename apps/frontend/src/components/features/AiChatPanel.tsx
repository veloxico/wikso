'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, Send, Trash2, MessageSquare, Sparkles, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { useAiChat, type AiMessage, type AiSource } from '@/hooks/useAiChat';
import { cn } from '@/lib/utils';

interface AiChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiChatPanel({ open, onOpenChange }: AiChatPanelProps) {
  const { t } = useTranslation();
  const chat = useAiChat();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      void chat.refreshConversations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Autoscroll as new content streams in.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat.messages, chat.streamBuffer]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || chat.streaming) return;
    setDraft('');
    await chat.sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleDelete = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm(t('aiChat.deleteConfirm'))) {
      return;
    }
    await chat.deleteConversation(id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-4xl"
      >
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            {t('aiChat.panelTitle')}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t('aiChat.placeholder')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Conversation list (left) */}
          <aside className="hidden w-56 shrink-0 border-r border-border md:flex md:flex-col">
            <div className="p-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => chat.startNewConversation()}
              >
                <Plus className="size-3.5" />
                {t('aiChat.newConversation')}
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {chat.conversations.length === 0 && !chat.loadingList ? (
                <p className="px-2 py-4 text-xs text-muted-foreground">
                  {t('aiChat.noConversations')}
                </p>
              ) : (
                <ul className="space-y-1">
                  {chat.conversations.map((c) => (
                    <li key={c.id}>
                      <div
                        className={cn(
                          'group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-accent',
                          chat.currentId === c.id && 'bg-accent',
                        )}
                      >
                        <button
                          type="button"
                          className="flex flex-1 items-center gap-2 truncate text-left"
                          onClick={() => chat.openConversation(c.id)}
                        >
                          <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{c.title}</span>
                        </button>
                        <button
                          type="button"
                          className="invisible rounded p-1 hover:bg-destructive/10 hover:text-destructive group-hover:visible"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDelete(c.id);
                          }}
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          {/* Chat pane (right) */}
          <div className="flex flex-1 min-w-0 flex-col">
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-4"
            >
              {chat.messages.length === 0 && !chat.streaming ? (
                <EmptyState text={t('aiChat.empty')} />
              ) : (
                <div className="mx-auto flex max-w-2xl flex-col gap-4">
                  {chat.messages.map((m) => (
                    <MessageBubble key={m.id} message={m} sourcesLabel={t('aiChat.sources')} />
                  ))}
                  {chat.streaming && (
                    <StreamingBubble text={chat.streamBuffer} thinkingLabel={t('aiChat.thinking')} />
                  )}
                </div>
              )}
            </div>

            {chat.error && (
              <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-destructive">
                {chat.error === 'errorNoProvider'
                  ? t('aiChat.errorNoProvider')
                  : t('aiChat.errorGeneric')}
              </div>
            )}

            {/* Composer */}
            <div className="border-t border-border p-3">
              <div className="mx-auto flex max-w-2xl items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('aiChat.placeholder')}
                  rows={2}
                  className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50"
                  disabled={chat.streaming}
                />
                <Button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={chat.streaming || draft.trim().length === 0}
                  size="icon"
                  aria-label="Send"
                >
                  {chat.streaming ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-center">
        <Sparkles className="size-10 text-muted-foreground/40" />
        <p className="max-w-xs text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function StreamingBubble({ text, thinkingLabel }: { text: string; thinkingLabel: string }) {
  if (!text) {
    return (
      <div className="self-start rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Loader2 className="size-3 animate-spin" />
          {thinkingLabel}
        </span>
      </div>
    );
  }
  return (
    <div className="self-start rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
      {text}
      <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-foreground align-middle" />
    </div>
  );
}

/**
 * Parses `[page:<uuid>]` citation markers out of the assistant text and
 * renders them as clickable chips linking to the source page.
 *
 * Uses the `sources` array on the message to look up page title/slug.
 */
function renderContentWithCitations(text: string, sources: AiSource[] | null | undefined) {
  const pattern = /\[page:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const pageId = match[1];
    const source = sources?.find((s) => s.pageId === pageId);
    if (source && source.spaceSlug && source.slug) {
      parts.push(
        <Link
          key={`cite-${idx}`}
          href={`/spaces/${source.spaceSlug}/pages/${source.pageId}`}
          className="mx-0.5 inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary hover:underline"
          title={source.title}
        >
          {source.title.length > 32 ? source.title.substring(0, 30) + '…' : source.title}
        </Link>,
      );
    } else {
      // No matching source — fall back to plain text.
      parts.push(
        <span key={`cite-${idx}`} className="text-xs text-muted-foreground">
          {match[0]}
        </span>,
      );
    }
    lastIndex = pattern.lastIndex;
    idx += 1;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

function MessageBubble({
  message,
  sourcesLabel,
}: {
  message: AiMessage;
  sourcesLabel: string;
}) {
  const isUser = message.role === 'user';
  const rendered = useMemo(
    () =>
      isUser ? [message.content] : renderContentWithCitations(message.content, message.sources),
    [isUser, message.content, message.sources],
  );

  return (
    <div
      className={cn(
        'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
        isUser ? 'self-end bg-primary text-primary-foreground' : 'self-start bg-muted',
      )}
    >
      <div>{rendered}</div>
      {!isUser && message.sources && message.sources.length > 0 && (
        <div className="mt-2 border-t border-border/50 pt-1.5">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{sourcesLabel}</p>
          <ul className="flex flex-wrap gap-1">
            {message.sources.map((s) => (
              <li key={s.pageId}>
                {s.spaceSlug ? (
                  <Link
                    href={`/spaces/${s.spaceSlug}/pages/${s.pageId}`}
                    className="inline-block rounded bg-background/60 px-1.5 py-0.5 text-xs hover:underline"
                  >
                    {s.title}
                  </Link>
                ) : (
                  <span className="inline-block rounded bg-background/60 px-1.5 py-0.5 text-xs">
                    {s.title}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
