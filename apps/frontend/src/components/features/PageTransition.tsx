'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Smooth page transition without unmounting/remounting children.
 *
 * Previous implementation used AnimatePresence mode="wait" which:
 *   1. Fades old content to opacity 0 (exit)
 *   2. Unmounts old — white flash visible
 *   3. Mounts new at opacity 0, fades in (enter)
 * Total ~300ms of partially invisible content = "hurts eyes".
 *
 * New approach: content stays mounted (no key-based remount). On pathname
 * change we apply a subtle CSS transition (opacity 0.88→1, translateY 3px→0).
 * Content is ALWAYS visible — minimum 88% opacity — so there is no flash.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip animation on initial mount
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const el = ref.current;
    if (!el) return;

    // Remove existing transition to set initial state instantly
    el.style.transition = 'none';
    el.style.opacity = '0.88';
    el.style.transform = 'translateY(3px)';

    // Force reflow so browser applies the above immediately
    el.getBoundingClientRect();

    // Now animate to final state
    el.style.transition = 'opacity 0.18s ease-out, transform 0.18s ease-out';
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  }, [pathname]);

  return (
    <div ref={ref} className="min-h-full">
      {children}
    </div>
  );
}
