'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock, Hash, History } from 'lucide-react';
import { cn } from '@/lib/utils';

const WORDS_PER_MINUTE = 238; // Medium's standard; close to Nielsen Norman's reading research

/**
 * Small metadata chip rendered under a page title: estimated reading
 * time, word count, and a relative "updated" timestamp. Lives outside
 * the editor so it can read the current document live even while the
 * user is typing — a MutationObserver on the reading surface keeps it
 * in sync.
 *
 * Kept intentionally understated — it's a reading signal, not a
 * feature bar. Jakarta tabular-nums prevent jitter as numbers tick.
 */
export function ReadingMeta({
  sourceSelector = '.wikso-editor, .wikso-reading',
  updatedAt,
  locale = 'en',
  className,
  labels,
}: {
  sourceSelector?: string;
  updatedAt?: string | Date | null;
  locale?: string;
  className?: string;
  /**
   * Caller-supplied localized labels. Keep ASCII fallbacks sensible so
   * the chip reads correctly even when the translation layer misses.
   */
  labels?: {
    minRead?: string; // e.g. "min read"
    words?: string; // e.g. "words"
    updated?: string; // e.g. "Updated"
  };
}) {
  const [words, setWords] = useState(0);

  // Capture Date.now() once, at first render, via useState's lazy
  // initializer — keeps the impure Date.now() call out of the
  // render path itself (so react-hooks/purity is happy) and gives a
  // stable "now" the useMemo below can depend on. The chip is a
  // reading signal, not a live clock — recomputing on stale
  // "minutes ago" isn't valuable.
  const [mountNow] = useState(() => Date.now());

  useEffect(() => {
    const source = document.querySelector(sourceSelector);
    if (!source) return;

    const recompute = () => {
      const text = (source as HTMLElement).innerText || '';
      // Match Unicode word-chars — works for non-Latin scripts too.
      const tokens = text.trim().match(/[\p{L}\p{N}'’-]+/gu);
      setWords(tokens ? tokens.length : 0);
    };

    recompute();
    const mo = new MutationObserver(() => recompute());
    mo.observe(source, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => mo.disconnect();
  }, [sourceSelector]);

  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));

  const relativeUpdated = useMemo(() => {
    if (!updatedAt) return null;
    const when =
      typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt;
    if (Number.isNaN(when.getTime())) return null;

    const deltaSec = (when.getTime() - mountNow) / 1000;
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    const absSec = Math.abs(deltaSec);
    if (absSec < 60) return rtf.format(Math.round(deltaSec), 'second');
    if (absSec < 3600) return rtf.format(Math.round(deltaSec / 60), 'minute');
    if (absSec < 86400) return rtf.format(Math.round(deltaSec / 3600), 'hour');
    if (absSec < 2592000)
      return rtf.format(Math.round(deltaSec / 86400), 'day');
    if (absSec < 31536000)
      return rtf.format(Math.round(deltaSec / 2592000), 'month');
    return rtf.format(Math.round(deltaSec / 31536000), 'year');
  }, [updatedAt, locale, mountNow]);

  // Don't render if there's nothing worth showing (brand-new empty page).
  if (words === 0 && !relativeUpdated) return null;

  // Localized number formatting so 1 243 groups use the right thousand separator.
  const wordsFmt = new Intl.NumberFormat(locale).format(words);

  const minReadLabel = labels?.minRead ?? 'min read';
  const wordsLabel = labels?.words ?? 'words';
  const updatedLabel = labels?.updated ?? 'Updated';

  return (
    <div className={cn('reading-meta', className)} aria-label="Reading metadata">
      {words > 0 && (
        <span>
          <Clock aria-hidden="true" />
          {minutes} {minReadLabel}
        </span>
      )}
      {words > 0 && (
        <span>
          <Hash aria-hidden="true" />
          {wordsFmt} {wordsLabel}
        </span>
      )}
      {relativeUpdated && (
        <span>
          <History aria-hidden="true" />
          {updatedLabel} {relativeUpdated}
        </span>
      )}
    </div>
  );
}
