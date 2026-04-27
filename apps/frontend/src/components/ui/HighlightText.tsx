import { useMemo } from 'react';

interface HighlightTextProps {
  /** The full text to render. May be undefined — treated as empty. */
  text: string | null | undefined;
  /** Substring to highlight. Empty/whitespace disables highlighting. */
  query: string;
  /** Optional `data-mark` value for stylesheet targeting. */
  variant?: 'search' | 'active';
  /** Optional className for the wrapping span. */
  className?: string;
}

/**
 * Wraps every case-insensitive occurrence of `query` inside `text` with a
 * `<mark>` element. Used by search dropdowns and result lists so the
 * paper-tape highlighter style in `globals.css` (`[data-mark="search"]`)
 * shows the user where their query matched.
 *
 * Splits on the literal query (escaped for regex) so multiline / unicode
 * stays intact. If the query is shorter than 1 char, returns the text
 * unchanged so we don't draw 80 zero-width marks for an empty query.
 */
export function HighlightText({
  text,
  query,
  variant = 'search',
  className,
}: HighlightTextProps) {
  const segments = useMemo(() => {
    // Coerce nullish text to "" so consumers can pass back-end values
    // that might be undefined without an extra `?? ''` at the call site.
    const safeText = text ?? '';
    const trimmed = query?.trim();
    if (!trimmed || trimmed.length < 1 || !safeText) {
      return [{ value: safeText, match: false }];
    }
    // Escape regex meta-chars so user input doesn't blow up
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${escaped})`, 'gi');
    return safeText
      .split(re)
      .filter((s) => s.length > 0)
      .map((s) => ({
        value: s,
        match: s.toLowerCase() === trimmed.toLowerCase(),
      }));
  }, [text, query]);

  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.match ? (
          <mark key={i} data-mark={variant}>
            {seg.value}
          </mark>
        ) : (
          <span key={i}>{seg.value}</span>
        ),
      )}
    </span>
  );
}
