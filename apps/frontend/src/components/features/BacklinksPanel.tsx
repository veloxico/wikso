'use client';

import Link from 'next/link';
import { ArrowUpRight, Link2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useBacklinks, type Backlink } from '@/hooks/useBacklinks';
import { cn } from '@/lib/utils';
import { bcp47Locale } from '@/lib/locale';

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
 * Presentation adopts the warm-paper language: each entry is rendered as a
 * `.wp-sidenote` (numbered ref circle, handwritten Caveat type, dashed
 * accent rule) rather than a flat list row. This turns the backlinks from a
 * generic "see also" panel into a classic editorial footnote block, which
 * matches the rest of the document's aesthetic. Loading uses the same
 * `.wp-inkbleed` drop-spreader as page load so nothing falls back to a
 * generic spinner.
 */
export function BacklinksPanel({ slug, pageId, className }: BacklinksPanelProps) {
  const { t, locale } = useTranslation();
  const { data: backlinks, isLoading } = useBacklinks(slug, pageId);

  if (isLoading) {
    return (
      <section className={cn('wp-card px-5 py-4', className)}>
        <div className="flex items-center gap-3">
          {/* Shrunk variant: override both width AND height inline
              (scale() alone left a 32×56 vertical oval because CSS
              kept `height: 56px`). Auto-margin is zeroed so the
              bleed sits flush against the label. */}
          <div
            className="wp-inkbleed"
            role="status"
            aria-busy="true"
            style={{ width: 28, height: 28, margin: 0 }}
          />
          <span className="wp-inkbleed-label" style={{ marginTop: 0 }}>
            {t('backlinks.loading') || 'Looking for mentions…'}
          </span>
        </div>
      </section>
    );
  }

  if (!backlinks || backlinks.length === 0) return null;

  return (
    <section className={cn('wp-card px-5 py-4', className)}>
      <header className="mb-3 flex items-center gap-2">
        <Link2 className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} strokeWidth={1.75} />
        <h2
          className="text-[11px] font-semibold uppercase"
          style={{
            color: 'var(--ink-3)',
            letterSpacing: '0.14em',
            fontFamily: 'var(--ui-font)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {t('backlinks.title') || 'Mentioned in'}
        </h2>
        <span
          className="ml-auto text-[11px]"
          style={{ color: 'var(--ink-4)', fontVariantNumeric: 'tabular-nums' }}
        >
          {backlinks.length}
        </span>
      </header>
      <ol className="space-y-2 list-none pl-0 m-0">
        {backlinks.map((b, i) => (
          <BacklinkRow key={b.id} backlink={b} index={i + 1} locale={locale} />
        ))}
      </ol>
    </section>
  );
}

/**
 * Natural-language relative timestamp — "3 days ago", "just now",
 * "last month". Uses the user's active locale via `Intl.RelativeTimeFormat`
 * which ships built-in with V8 and covers all 11 of our locales.
 *
 * For events older than ~30 days we fall back to the absolute date
 * (e.g. "16 Apr") because "5 weeks ago" reads as vague. This mirrors
 * how Slack, GitHub and Notion render timestamps: relative when it's
 * recent and emotionally meaningful, absolute when it's just noise.
 *
 * `numeric: 'auto'` lets the formatter use idiomatic phrases like
 * "yesterday" / "вчера" / "ayer" instead of "1 day ago" — slight
 * width inconsistency in the row, but reads more naturally.
 *
 * The `locale` argument is passed through `bcp47Locale()` because our
 * internal codes (`esAR`, `ptBR`) are not valid BCP-47 tags and would
 * cause `Intl.RelativeTimeFormat` to throw `RangeError`, crashing the
 * entire panel for those users.
 */
function formatRelative(iso: string, locale: string): string {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return '';
  const diffMs = target - Date.now();
  const absMs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;

  const tag = bcp47Locale(locale);
  const rtf = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' });

  if (absMs < minute) return rtf.format(0, 'second');
  if (absMs < hour) return rtf.format(Math.round(diffMs / minute), 'minute');
  if (absMs < day) return rtf.format(Math.round(diffMs / hour), 'hour');
  if (absMs < week) return rtf.format(Math.round(diffMs / day), 'day');
  if (absMs < month) return rtf.format(Math.round(diffMs / week), 'week');

  // Older — show an absolute short date instead of "5 weeks ago".
  return new Date(iso).toLocaleDateString(tag, {
    day: 'numeric',
    month: 'short',
  });
}

function BacklinkRow({
  backlink,
  index,
  locale,
}: {
  backlink: Backlink;
  index: number;
  locale: string;
}) {
  const href = `/spaces/${backlink.space.slug}/pages/${backlink.id}`;
  const relTime = formatRelative(backlink.updatedAt, locale);
  return (
    <li className="list-none">
      <Link
        href={href}
        className="group block rounded-md no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg-raised)]"
      >
        {/* `.wp-sidenote` primitive drops its default `margin: 14px 0`
            here — the parent `<ol>` uses `space-y-2` for spacing, and
            stacking both gave an inconsistent 14px-first / 22px-between
            rhythm. Group-hover lifts the background opacity so the row
            feels tappable. */}
        <div
          className="wp-sidenote transition-[background,border-color] duration-150 group-hover:border-l-[color:var(--accent-hover)]"
          style={{ margin: 0 }}
        >
          <span className="ref" aria-hidden="true">{index}</span>
          <span
            style={{
              color: 'var(--ink)',
              fontFamily: 'var(--body-font)',
              fontSize: '14px',
              fontWeight: 500,
              letterSpacing: '-0.005em',
            }}
          >
            {backlink.title}
          </span>
          <span
            className="ml-1"
            style={{
              fontFamily: 'var(--ui-font)',
              fontSize: '11.5px',
              color: 'var(--ink-3)',
            }}
          >
            — {backlink.space.name}
            {' · '}
            <time dateTime={backlink.updatedAt} title={new Date(backlink.updatedAt).toLocaleString(bcp47Locale(locale))}>
              {relTime}
            </time>
            {backlink.author?.name ? ` · ${backlink.author.name}` : ''}
          </span>
          <ArrowUpRight
            className="ml-1 inline-block h-3 w-3 align-[-1px] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            style={{ color: 'var(--ink-4)' }}
            strokeWidth={1.75}
          />
        </div>
      </Link>
    </li>
  );
}
