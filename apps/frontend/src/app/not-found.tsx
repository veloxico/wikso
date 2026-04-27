'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Custom 404. The hero is a CSS-only paper-bag character (built in
 * globals.css under `.wp-404-bag`) so we don't ship an SVG asset for it.
 * The middle "0" of the 404 wears the bag like a hat — a small visual
 * gag that gives the page personality without being distracting.
 */
export default function NotFound() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <main className="wp-404">
      <div className="wp-404-stage">
        {/* Bag character — pure CSS face. Tucks behind the page numbers
            via negative margin so it appears to wear them. */}
        <div className="wp-404-bag" aria-hidden="true">
          <div className="wp-404-eyes">
            <span />
            <span />
          </div>
          <div className="wp-404-mouth" />
          <div className="wp-404-tag">404 · Lost</div>
        </div>

        {/* Big number with a tilted middle digit */}
        <div className="wp-404-code" aria-hidden="true">
          <span className="digit">4</span>
          <span className="digit middle">0</span>
          <span className="digit">4</span>
        </div>

        <h1 className="wp-404-title">
          {t('errors.notFound.title') || 'This page wandered off'}
        </h1>
        <p className="wp-404-desc">
          {t('errors.notFound.description') ||
            "We couldn't find what you were looking for. It might have been moved, renamed, or deleted — or maybe the link was wrong all along."}
        </p>

        <div className="wp-404-actions">
          <Link href="/spaces" className="primary">
            <Home className="h-3.5 w-3.5" />
            {t('errors.notFound.backToHome') || 'Back to home'}
          </Link>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              // `router.back()` is a no-op when the tab has no history
              // (e.g. someone shared a broken link and the 404 is the
              // first page in the tab). Fall back to /spaces in that case
              // so the button never appears dead.
              if (
                typeof window !== 'undefined' &&
                window.history.length > 1
              ) {
                router.back();
              } else {
                router.push('/spaces');
              }
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('common.back') || 'Go back'}
          </button>
        </div>
      </div>
    </main>
  );
}
