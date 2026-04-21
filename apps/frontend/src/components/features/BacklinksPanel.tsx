'use client';

import Link from 'next/link';
import { ArrowUpRight, Link2, Loader2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useBacklinks, type Backlink } from '@/hooks/useBacklinks';
import { cn } from '@/lib/utils';

interface BacklinksPanelProps {
  slug: string;
  pageId: string;
  className?: string;
}

/**
 * "Mentioned in" panel — surfaces every other page that links to the current
 * one. Renders only when there's something to show (or while loading) so it
 * stays out of the way for unconnected pages.
 *
 * Visual identity is intentionally subdued: a hairline-bordered card with a
 * small icon header, items as compact list rows. The interest is in the
 * relationships, not the chrome.
 */
export function BacklinksPanel({ slug, pageId, className }: BacklinksPanelProps) {
  const { t, locale } = useTranslation();
  const { data: backlinks, isLoading } = useBacklinks(slug, pageId);

  if (isLoading) {
    return (
      <section className={cn('rounded-xl border border-border/60 bg-card/40 p-4', className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('backlinks.loading') || 'Looking for mentions…'}
        </div>
      </section>
    );
  }

  if (!backlinks || backlinks.length === 0) return null;

  return (
    <section className={cn('rounded-xl border border-border/60 bg-card/40', className)}>
      <header className="flex items-center gap-2 border-b border-border/50 px-4 py-2.5">
        <Link2 className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('backlinks.title') || 'Mentioned in'}
        </h2>
        <span className="ml-auto text-[11px] font-medium text-muted-foreground/70">
          {backlinks.length}
        </span>
      </header>
      <ul className="divide-y divide-border/40">
        {backlinks.map((b) => (
          <BacklinkRow key={b.id} backlink={b} locale={locale} />
        ))}
      </ul>
    </section>
  );
}

function BacklinkRow({ backlink, locale }: { backlink: Backlink; locale: string }) {
  const href = `/spaces/${backlink.space.slug}/pages/${backlink.id}`;
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-accent/40"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-foreground/90 group-hover:text-foreground">
            {backlink.title}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="truncate">{backlink.space.name}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">
              {new Date(backlink.updatedAt).toLocaleDateString(locale)}
            </span>
            {backlink.author?.name ? (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{backlink.author.name}</span>
              </>
            ) : null}
          </div>
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
      </Link>
    </li>
  );
}
