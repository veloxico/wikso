'use client';

import { useEffect, useState } from 'react';

/**
 * A 2px progress bar pinned to the top of the viewport that reflects how far
 * the user has scrolled through the current document. Unlike the conventional
 * `document.body`-based implementations, this reads from a specific scroll
 * container so it works inside dashboard layouts where the page itself
 * doesn't scroll (the main column does).
 *
 * Pass `containerRef` to track a specific scrollable element. When omitted it
 * falls back to `window` scroll so it also works on marketing / public
 * share pages.
 */
export function ReadingProgress({
  containerRef,
  className = '',
}: {
  containerRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const target: HTMLElement | Window = containerRef?.current ?? window;

    const compute = () => {
      if (target instanceof Window) {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const max =
          document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? Math.min(1, Math.max(0, scrollTop / max)) : 0;
        setProgress(pct);
      } else {
        const el = target as HTMLElement;
        const max = el.scrollHeight - el.clientHeight;
        const pct = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;
        setProgress(pct);
      }
    };

    compute();
    const opts: AddEventListenerOptions = { passive: true };
    target.addEventListener('scroll', compute, opts);
    window.addEventListener('resize', compute, opts);
    return () => {
      target.removeEventListener('scroll', compute);
      window.removeEventListener('resize', compute);
    };
  }, [containerRef]);

  // Hide the bar entirely when the page is too short to scroll —
  // a permanent 0% bar would just look like a header rule.
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] ${className}`}
      aria-hidden
    >
      <div
        className="h-full origin-left transition-[width] duration-150 ease-out"
        style={{
          width: `${(progress * 100).toFixed(2)}%`,
          background: 'var(--accent)',
          boxShadow: progress > 0 ? '0 0 10px var(--accent-soft)' : 'none',
        }}
      />
    </div>
  );
}
