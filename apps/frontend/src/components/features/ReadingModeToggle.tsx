'use client';

import { useEffect, useState, useCallback } from 'react';
import { BookOpen, X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const STORAGE_KEY = 'wikso:reading-mode';
const KEY_HINT = 'R';

/**
 * Programmatically disable reading mode. Used by callers (e.g. page.tsx
 * when the user clicks "Edit") to ensure the editing chrome reappears
 * without forcing the user to also press the toggle. Safe to call from
 * anywhere; no-ops on the server.
 */
export function disableReadingMode() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, 'false');
  document.documentElement.removeAttribute('data-reading');
}

/**
 * Topbar pill that toggles a focused "reading mode" on the document.
 *
 * Sets `data-reading="true"` on the `<html>` element. The accompanying
 * CSS in globals.css then hides every chrome surface marked with a
 * `data-chrome` attribute (sidebar, toolbar, secondary topbar, comments,
 * outline) and centres the editor column at a more comfortable measure.
 *
 * The preference persists across sessions via localStorage so a reader
 * who flipped it on once doesn't have to do it again every time. We
 * also bind a top-level `R` shortcut (ignored when typing in inputs)
 * so it feels like a first-class reading control.
 */
export function ReadingModeToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [reading, setReading] = useState(false);

  // Hydrate from localStorage on mount and apply to <html>.
  // Mount-only sync from an external store (localStorage); React's
  // set-state-in-effect rule complains, but this is the canonical pattern
  // for "hydrate from localStorage" and we don't have access to a store.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(STORAGE_KEY) === 'true';
    if (saved) {
      document.documentElement.setAttribute('data-reading', 'true');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReading(true);
    }
  }, []);

  const toggle = useCallback(() => {
    setReading((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, String(next));
        if (next) {
          document.documentElement.setAttribute('data-reading', 'true');
        } else {
          document.documentElement.removeAttribute('data-reading');
        }
      }
      return next;
    });
  }, []);

  // Strip `data-reading` on unmount so the attribute doesn't leak into
  // routes that don't have a toggle to undo it (sidebar / topbar / etc.
  // would otherwise stay hidden everywhere). The `localStorage` value
  // remains untouched, so the next mount re-hydrates the preference.
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.documentElement.removeAttribute('data-reading');
      }
    };
  }, []);

  // Global "R" hotkey — ignored if focus is in editable contexts so it
  // doesn't fight with the editor.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'r' && e.key !== 'R') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const tgt = e.target as HTMLElement | null;
      if (!tgt) return;
      const tag = tgt.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tgt.isContentEditable) return;
      e.preventDefault();
      toggle();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggle]);

  return (
    <button
      type="button"
      className={`wp-reading-toggle ${className || ''}`}
      data-active={reading ? 'true' : undefined}
      onClick={toggle}
      title={`${reading ? t('reading.exit') || 'Exit reading mode' : t('reading.enter') || 'Reading mode'} (${KEY_HINT})`}
      aria-pressed={reading}
    >
      {reading ? (
        <X className="h-3.5 w-3.5" />
      ) : (
        <BookOpen className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">
        {reading
          ? t('reading.exitShort') || 'Exit reading'
          : t('reading.enter') || 'Read'}
      </span>
    </button>
  );
}
