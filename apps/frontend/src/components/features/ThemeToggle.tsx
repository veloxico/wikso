'use client';

import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useEffect, useState, type MouseEvent } from 'react';
import { cn } from '@/lib/utils';

type ThemeValue = 'light' | 'dark' | 'system';

const ORDER: ThemeValue[] = ['light', 'dark', 'system'];

/**
 * Standalone theme toggle that cycles light → dark → system. The icon
 * swap is animated via Framer Motion (rotate + scale + fade), and the
 * page-wide theme swap itself is wrapped in the View Transitions API
 * so the new theme reveals as a circular wipe from the click point.
 * Both animations no-op when prefers-reduced-motion is set, and the
 * view-transitions branch silently falls back to a direct setTheme on
 * browsers that don't support it (Firefox pre-128, Safari pre-18).
 *
 * Can render as an inline button (`variant="inline"`, default) or as a
 * DropdownMenuItem-like row (`variant="menu"`) so it slots cleanly
 * into the existing UserMenu without a layout fight.
 */
export function ThemeToggle({
  className,
  variant = 'inline',
  labels,
}: {
  className?: string;
  variant?: 'inline' | 'menu';
  labels?: { light: string; dark: string; system: string; theme: string };
}) {
  const { theme, setTheme } = useTheme();
  // next-themes populates `theme` only after mount — canonical
  // hydration-safe pattern: render a placeholder until the effect
  // has flipped `mounted`. The setState-in-effect lint is disabled
  // because this *is* the intended use (telling React "we're on the
  // client now") rather than the cascading-render smell it warns
  // about.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const current = (theme as ThemeValue | undefined) ?? 'system';

  const cycle = (e: MouseEvent<HTMLButtonElement>) => {
    const idx = ORDER.indexOf(current);
    const next = ORDER[(idx + 1) % ORDER.length];

    // Origin for the circular clip-path wipe — the toggle's geometric
    // center in viewport coordinates. Pushed onto documentElement so
    // the keyframe can pick it up.
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    type DocWithVT = Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    const doc = document as DocWithVT;
    if (prefersReducedMotion || typeof doc.startViewTransition !== 'function') {
      setTheme(next);
      return;
    }

    document.documentElement.style.setProperty('--wipe-x', `${x}px`);
    document.documentElement.style.setProperty('--wipe-y', `${y}px`);
    doc.startViewTransition(() => setTheme(next));
  };

  // Pre-mount SSR render — match the dark-default set in Providers so
  // there's no hydration flash.
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label={labels?.theme ?? 'Toggle theme'}
        className={cn(
          variant === 'menu'
            ? 'flex w-full items-center gap-2 px-2 py-1.5 text-sm'
            : 'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground',
          className,
        )}
      >
        <Moon className="h-4 w-4" />
      </button>
    );
  }

  const Icon = current === 'dark' ? Moon : current === 'light' ? Sun : Monitor;
  const themeLabel =
    current === 'dark'
      ? labels?.dark ?? 'Dark'
      : current === 'light'
        ? labels?.light ?? 'Light'
        : labels?.system ?? 'System';

  if (variant === 'menu') {
    return (
      <button
        type="button"
        onClick={cycle}
        aria-label={`${labels?.theme ?? 'Theme'}: ${themeLabel}`}
        className={cn(
          'relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden',
          'hover:bg-accent hover:text-accent-foreground',
          'focus:bg-accent focus:text-accent-foreground',
          className,
        )}
      >
        <span className="relative inline-flex h-4 w-4 items-center justify-center overflow-visible">
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              key={current}
              initial={{ rotate: -90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="inline-flex"
              aria-hidden="true"
            >
              <Icon className="h-4 w-4" />
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="flex-1 text-left">
          {labels?.theme ?? 'Theme'}: {themeLabel}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${labels?.theme ?? 'Theme'}: ${themeLabel}`}
      title={`${labels?.theme ?? 'Theme'}: ${themeLabel}`}
      className={cn(
        'relative inline-flex h-8 w-8 items-center justify-center rounded-md',
        'text-muted-foreground hover:text-foreground hover:bg-accent/60',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={current}
          initial={{ rotate: -90, scale: 0, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="inline-flex"
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
