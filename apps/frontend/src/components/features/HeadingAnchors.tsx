'use client';

import { useEffect } from 'react';

/**
 * Enhances every `h1..h3` inside a reading surface with a floating
 * anchor-copy button (revealed on heading hover). Clicking it writes
 * the deep link to the clipboard and updates the URL hash so the user
 * can share a specific section. Mirrors the behavior Substack / Notion
 * attach to their editorial surfaces.
 *
 * The component renders nothing itself — it runs a side-effect that
 * mutates the DOM scanned by `sourceSelector`. A MutationObserver
 * keeps the button present as the editor content shifts. IDs are
 * assigned with the same slug scheme PageOutline uses, so anchors and
 * outline stay in sync regardless of mount order.
 */
export function HeadingAnchors({
  sourceSelector = '.wikso-editor, .wikso-reading',
}: {
  sourceSelector?: string;
}) {
  useEffect(() => {
    const source = document.querySelector(sourceSelector);
    if (!source) return;

    const ensureAnchor = (heading: HTMLHeadingElement, index: number) => {
      if (!heading.id) {
        const slug =
          (heading.textContent || '')
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .slice(0, 60) || `section-${index}`;
        heading.id = `h-${slug}`;
        heading.style.scrollMarginTop = '5rem';
      }

      // Idempotent — skip if we already attached a button.
      if (heading.querySelector(':scope > .heading-anchor-btn')) return;

      const btn = document.createElement('a');
      btn.className = 'heading-anchor-btn';
      btn.href = `#${heading.id}`;
      btn.setAttribute('aria-label', 'Copy link to section');
      btn.setAttribute('title', 'Copy link to section');
      btn.textContent = '#';
      btn.tabIndex = 0;
      heading.appendChild(btn);
    };

    const scan = () => {
      const headings = source.querySelectorAll<HTMLHeadingElement>(
        'h1, h2, h3',
      );
      headings.forEach((h, i) => ensureAnchor(h, i));
    };

    // Event delegation — a single click listener on the source handles
    // every anchor regardless of how many headings get added/removed.
    const onClick = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target?.classList.contains('heading-anchor-btn')) return;
      e.preventDefault();
      const anchor = target as HTMLAnchorElement;
      const heading = anchor.parentElement as HTMLElement | null;
      if (!heading?.id) return;

      // Build the absolute URL so copy-paste works from anywhere.
      const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${heading.id}`;
      try {
        void navigator.clipboard.writeText(url);
      } catch {
        /* clipboard blocked — degrade gracefully, hash still updates */
      }
      // Update hash without a full scroll jump; let the heading's
      // scroll-margin-top do the positioning.
      history.replaceState(null, '', `#${heading.id}`);
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Flash a confirmation badge via CSS `data-copied` attribute.
      anchor.setAttribute('data-copied', 'true');
      window.setTimeout(() => anchor.removeAttribute('data-copied'), 1200);
    };

    scan();
    source.addEventListener('click', onClick);

    const mo = new MutationObserver(() => scan());
    mo.observe(source, { childList: true, subtree: true, characterData: true });

    return () => {
      mo.disconnect();
      source.removeEventListener('click', onClick);
    };
  }, [sourceSelector]);

  return null;
}
