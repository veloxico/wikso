'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Heading {
  id: string;
  text: string;
  level: number;
}

/**
 * A scroll-spy table-of-contents rendered as a slim right rail. Scans the
 * `.wikso-editor` / `.wikso-reading` surface for `h1..h3`, assigns stable
 * slug-based anchors, and uses IntersectionObserver to keep the active entry
 * highlighted as the reader scrolls. On mobile the outline is hidden — the
 * reader already has the content in front of them.
 *
 * The `sourceSelector` lets callers retarget it to a non-standard surface
 * (e.g. public share viewer) without a second component.
 */
export function PageOutline({
  sourceSelector = '.wikso-editor, .wikso-reading',
  label = 'On this page',
  className = '',
}: {
  sourceSelector?: string;
  label?: string;
  className?: string;
}) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Collect headings + assign ids. Rerun when the document content mutates.
  useEffect(() => {
    const source = document.querySelector(sourceSelector);
    if (!source) return;

    const collect = () => {
      const nodes = Array.from(
        source.querySelectorAll<HTMLHeadingElement>('h1, h2, h3'),
      );
      const found: Heading[] = nodes.map((el, i) => {
        if (!el.id) {
          // Derive a stable slug from the heading text; fall back to index.
          const slug =
            (el.textContent || '')
              .toLowerCase()
              .trim()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-')
              .slice(0, 60) || `section-${i}`;
          el.id = `h-${slug}`;
          el.style.scrollMarginTop = '5rem';
        }
        return {
          id: el.id,
          text: el.textContent?.trim() || '(untitled)',
          level: Number(el.tagName.substring(1)) || 2,
        };
      });
      setHeadings(found);
    };

    collect();

    // Cheap recompute on DOM mutations — editor content shifts as users type.
    const mo = new MutationObserver(() => collect());
    mo.observe(source, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [sourceSelector]);

  // Scroll-spy: pick the topmost visible heading.
  useEffect(() => {
    if (headings.length === 0) return;
    observerRef.current?.disconnect();
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId((visible[0].target as HTMLElement).id);
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    );
    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) io.observe(el);
    }
    observerRef.current = io;
    return () => io.disconnect();
  }, [headings]);

  const indent = useMemo(
    () => ({ 1: 'pl-0', 2: 'pl-3', 3: 'pl-6' } as const),
    [],
  );

  if (headings.length < 2) return null; // No TOC for single-heading pages

  return (
    <aside
      data-chrome="outline"
      className={cn(
        'hidden xl:block sticky top-24 self-start w-56 shrink-0',
        className,
      )}
      aria-label={label}
      style={{
        fontFamily: 'var(--ui-font)',
        fontSize: '13px',
      }}
    >
      <div
        className="mb-3 text-[10.5px] font-semibold uppercase"
        style={{
          color: 'var(--ink-4)',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </div>
      <ul
        className="space-y-0.5 pl-px"
        style={{ borderLeft: '1px dashed var(--rule)' }}
      >
        {headings.map((h) => {
          const active = h.id === activeId;
          return (
            <li key={h.id} className={cn('relative', indent[h.level as 1 | 2 | 3])}>
              <a
                href={`#${h.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById(h.id)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  setActiveId(h.id);
                }}
                className={cn(
                  'relative block py-1.5 pl-3 transition-all duration-150',
                  'hover:translate-x-px',
                )}
                style={{
                  color: active ? 'var(--ink)' : 'var(--ink-3)',
                  fontWeight: active ? 600 : 400,
                  borderRadius: '0 4px 4px 0',
                }}
                title={h.text}
              >
                {/* Sliding active-indicator — solid accent stroke that
                    glides between rows. The `layoutId` keeps a single
                    DOM node so transitions stay fluid. */}
                {active && (
                  <motion.span
                    layoutId="toc-active-bar"
                    className="absolute -left-px top-0 bottom-0 w-[2px]"
                    style={{
                      background: 'var(--accent)',
                      borderRadius: '2px',
                    }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    aria-hidden="true"
                  />
                )}
                <span className="line-clamp-2 relative">{h.text}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
