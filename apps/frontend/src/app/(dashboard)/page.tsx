'use client';

/**
 * Dashboard — warm-paper greeting + quick actions + two-column recents/favorites.
 *
 * Layout choices:
 *   • `.wp-hero` two-tone serif greeting ("Hi, **Name**") sets the editorial
 *     tone before the user even reads anything.
 *   • Caveat handwritten "today ✦" accent lives next to the subtitle as the
 *     one place handwriting appears on the page — keeps it special.
 *   • Quick-action grid is 4-up on md+ / 2-up on small screens. Each card is
 *     a real <Link> so middle-click + right-click work.
 *   • Two-column 2fr/1fr below the fold. Recent on the left because that's
 *     the bigger list and where the eye lands first; favorites on the right
 *     as the curated short-list. We intentionally don't show an activity
 *     feed yet — there's no API for it, and a fake/empty one looked worse
 *     than just leaving it off.
 *
 * Empty state uses `.wp-empty` (centered, oversized emoji, serif title) so
 * a brand-new tenant gets the same warm welcome instead of an enterprise
 * "no data" placeholder.
 */

import Link from 'next/link';
import { FileText, Star, Clock, Plus, FileStack, Sparkles, Upload } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/store/authStore';
import { useRecentPages } from '@/hooks/useRecentPages';
import { useFavorites } from '@/hooks/useFavorites';

function timeAgo(date: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return t('dashboard.justNow');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('dashboard.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('dashboard.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('dashboard.daysAgo', { count: days });
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { data: recentPages } = useRecentPages();
  const { data: favorites } = useFavorites();

  const displayName = user?.name?.split(' ')[0] || '';
  const recentItems = recentPages?.slice(0, 8) || [];
  const favoriteItems = favorites?.slice(0, 6) || [];
  const isEmpty = recentItems.length === 0 && favoriteItems.length === 0;

  if (isEmpty) {
    return (
      <div className="wp-empty">
        <div className="wp-empty-emoji">📜</div>
        <h1 className="wp-empty-title">{t('dashboard.emptyTitle')}</h1>
        <p className="wp-sub mt-2 justify-center">
          {t('dashboard.emptyDescription')}
          <span className="wp-hand">{t('dashboard.todayHand')}</span>
        </p>
        <div className="mt-8">
          <Link href="/spaces" className="wp-qa inline-flex flex-row items-center gap-3 px-4 py-3">
            <span className="wp-qa-icon"><FileStack className="h-4 w-4" /></span>
            <span className="wp-qa-title">{t('dashboard.createFirstSpace')}</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 py-10 md:px-12 md:py-14">
      {/* Hero — two-tone serif greeting + subtle handwritten accent.
          The `wp-hero-name` wrapper carries an SVG underline that
          self-animates via stroke-dasharray on mount (see globals.css
          `.wp-hero-underline`). The stroke uses the active accent so
          the underline follows whatever palette the user has set. */}
      <header className="mb-10 md:mb-12">
        <h1 className="wp-hero">
          {displayName ? (
            <>
              <span className="wp-greeting">{t('dashboard.greeting')}</span>{' '}
              <span className="wp-hero-name">
                <span className="wp-name">{displayName}</span>
                <svg
                  className="wp-hero-underline"
                  viewBox="0 0 200 14"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {/* Slightly off-axis curve so the stroke reads as
                      hand-drawn rather than a generic CSS rule. The
                      dasharray + dashoffset are wired in globals.css. */}
                  <path d="M 4 8 C 60 2, 130 4, 196 7" fill="none" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </span>
            </>
          ) : (
            <span className="wp-name">{t('dashboard.greetingGeneric')}</span>
          )}
        </h1>
        <p className="wp-sub mt-3">
          {t('dashboard.subtitle')}
          <span className="wp-hand">{t('dashboard.todayHand')}</span>
        </p>
      </header>

      {/* Quick actions — 4-up on md+, 2-up on small */}
      <div className="mb-12 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Link href="/spaces" className="wp-qa">
          <div className="wp-qa-icon"><Plus className="h-4 w-4" strokeWidth={1.75} /></div>
          <div>
            <div className="wp-qa-title">{t('dashboard.qaEmpty')}</div>
            <div className="wp-qa-sub">{t('dashboard.qaEmptySub')}</div>
          </div>
        </Link>
        <Link href="/spaces" className="wp-qa">
          <div className="wp-qa-icon"><FileStack className="h-4 w-4" strokeWidth={1.75} /></div>
          <div>
            <div className="wp-qa-title">{t('dashboard.qaTemplate')}</div>
            <div className="wp-qa-sub">{t('dashboard.qaTemplateSub')}</div>
          </div>
        </Link>
        <Link href="/spaces" className="wp-qa">
          <div className="wp-qa-icon"><Sparkles className="h-4 w-4" strokeWidth={1.75} /></div>
          <div>
            <div className="wp-qa-title">{t('dashboard.qaAi')}</div>
            <div className="wp-qa-sub">{t('dashboard.qaAiSub')}</div>
          </div>
        </Link>
        <Link href="/spaces" className="wp-qa">
          <div className="wp-qa-icon"><Upload className="h-4 w-4" strokeWidth={1.75} /></div>
          <div>
            <div className="wp-qa-title">{t('dashboard.qaImport')}</div>
            <div className="wp-qa-sub">{t('dashboard.qaImportSub')}</div>
          </div>
        </Link>
      </div>

      {/* Two-column layout: recent (2fr) | favorites (1fr)
       *
       * Empty states now use the `.wp-empty-card` primitive (dashed
       * sunken card with a circular accent glyph) instead of a
       * hand-rolled `rounded-lg border` div. Same visual target, but
       * now driven by a single CSS definition that the rest of the
       * product can reuse — and dark mode handles it without needing
       * an explicit override here.
       *
       * Favorited items carry a tiny accent-colored fabric ribbon
       * (`.wp-ribbon`) pinned to the top-right of the card — a
       * classic "bookmark" cue that makes the favorites column
       * distinguishable even when you scroll past the header. */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[2fr_1fr] lg:gap-12">
        {/* Recent */}
        <section>
          <h2 className="wp-section-title">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
            {t('dashboard.recentPages')}
          </h2>
          {recentItems.length === 0 ? (
            <div className="wp-empty-card">
              <div className="glyph">
                <FileText className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <p>{t('dashboard.noRecentPages')}</p>
              <p className="hint">{t('dashboard.noRecentPagesHint') || 'Open a page and it will appear here.'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/spaces/${item.page.space.slug}/pages/${item.page.id}`}
                  className="wp-rec"
                >
                  <FileText className="h-5 w-5 text-[color:var(--ink-3)]" strokeWidth={1.5} />
                  <div className="wp-rec-body">
                    <div className="wp-rec-title">{item.page.title}</div>
                    <div className="wp-rec-path">{item.page.space.name}</div>
                  </div>
                  <span className="wp-rec-time">{timeAgo(item.visitedAt, t)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Favorites */}
        <section>
          <h2 className="wp-section-title">
            <Star className="h-3.5 w-3.5" strokeWidth={1.75} />
            {t('dashboard.favorites')}
          </h2>
          {favoriteItems.length === 0 ? (
            <div className="wp-empty-card">
              <div className="glyph">
                <Star className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <p>{t('dashboard.noFavorites')}</p>
              <p className="hint">{t('dashboard.noFavoritesHint') || 'Star a page to pin it to the top of your workspace.'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {favoriteItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/spaces/${item.page.space.slug}/pages/${item.page.id}`}
                  className="wp-rec relative"
                >
                  {/* Fabric bookmark — purely decorative; screen readers
                      already hear "favorites" from the section heading. */}
                  <span className="wp-ribbon" aria-hidden="true" />
                  <Star
                    className="h-5 w-5 text-[color:var(--accent)]"
                    strokeWidth={1.5}
                    fill="currentColor"
                    fillOpacity={0.18}
                  />
                  <div className="wp-rec-body">
                    <div className="wp-rec-title">{item.page.title}</div>
                    <div className="wp-rec-path">{item.page.space.name}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
