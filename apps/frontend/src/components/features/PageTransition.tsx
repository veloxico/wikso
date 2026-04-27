'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Smooth page transition without unmounting/remounting children.
 *
 * Content stays mounted (no key-based remount). On pathname change we apply
 * a subtle CSS transition (opacity 0.92→1, translateY 4px→0). Content is
 * ALWAYS visible — minimum 92% opacity — so there is no flash.
 *
 * Uses CSS transitions instead of Framer Motion AnimatePresence to avoid
 * the unmount/remount cycle that causes white flashes.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const el = ref.current;
    if (!el) return;

    el.style.transition = 'none';
    el.style.opacity = '0.92';
    el.style.transform = 'translateY(4px)';

    el.getBoundingClientRect();

    el.style.transition = 'opacity 0.25s cubic-bezier(0.25, 0.4, 0.25, 1), transform 0.25s cubic-bezier(0.25, 0.4, 0.25, 1)';
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  }, [pathname]);

  return (
    <div ref={ref} className="min-h-full">
      {children}
    </div>
  );
}
