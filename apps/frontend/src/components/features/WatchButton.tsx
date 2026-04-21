'use client';

import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { usePageWatchStatus, useWatchPage, useUnwatchPage } from '@/hooks/usePageWatch';
import { cn } from '@/lib/utils';

interface WatchButtonProps {
  slug: string;
  pageId: string;
  /** Compact (icon-only) variant for crowded headers. */
  compact?: boolean;
}

/**
 * Subscribe / unsubscribe to changes on a page.
 *
 * Shows an Eye icon that toggles to EyeOff when the user is watching;
 * the watcher count sits next to it so the page author can see how many
 * teammates have opted in. The toggle is optimistic — the icon flips
 * immediately and reverts only on a server error.
 */
export function WatchButton({ slug, pageId, compact = false }: WatchButtonProps) {
  const { t } = useTranslation();
  const { data, isLoading } = usePageWatchStatus(slug, pageId);
  const watch = useWatchPage(slug, pageId);
  const unwatch = useUnwatchPage(slug, pageId);

  const watching = data?.watching ?? false;
  const count = data?.watcherCount ?? 0;
  const busy = isLoading || watch.isPending || unwatch.isPending;

  const onClick = () => {
    if (busy) return;
    if (watching) unwatch.mutate();
    else watch.mutate();
  };

  const label = watching ? t('watch.unwatch') : t('watch.watch');
  const Icon = watching ? EyeOff : Eye;
  const title = watching
    ? t('watch.tooltipUnwatch') || 'Stop receiving updates about this page'
    : t('watch.tooltipWatch') || 'Get notified when this page changes';

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={busy}
      title={title}
      aria-pressed={watching}
      className={cn(
        'gap-1.5 transition-colors',
        watching && 'text-primary hover:text-primary',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {!compact && <span className="hidden sm:inline">{label}</span>}
      {count > 0 && (
        <span
          className={cn(
            'ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-medium leading-4',
            watching
              ? 'bg-primary/15 text-primary'
              : 'bg-foreground/8 text-foreground/60',
          )}
        >
          {count}
        </span>
      )}
    </Button>
  );
}
