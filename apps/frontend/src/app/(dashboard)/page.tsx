'use client';

import Link from 'next/link';
import { FileText, Star, Clock, Plus, Search, ArrowRight, Layers, Sparkles } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/store/authStore';
import { useRecentPages } from '@/hooks/useRecentPages';
import { useFavorites } from '@/hooks/useFavorites';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
  const recentItems = recentPages?.slice(0, 10) || [];
  const favoriteItems = favorites?.slice(0, 10) || [];
  const isEmpty = recentItems.length === 0 && favoriteItems.length === 0;

  if (isEmpty) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex flex-col items-center justify-center py-12 md:py-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6">
            <Sparkles className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-bold mb-2">{t('dashboard.emptyTitle')}</h1>
          <p className="text-muted-foreground mb-8 max-w-md">
            {t('dashboard.emptyDescription')}
          </p>
          <Button asChild size="lg">
            <Link href="/spaces">
              <Layers className="mr-2 h-5 w-5" />
              {t('dashboard.createFirstSpace')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      {/* Welcome header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl font-bold">
          {displayName
            ? t('dashboard.welcome', { name: displayName })
            : t('dashboard.welcomeGeneric')}
        </h1>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-6 md:mb-8">
        <Button asChild>
          <Link href="/spaces">
            <Plus className="mr-2 h-4 w-4" />
            {t('dashboard.newPage')}
          </Link>
        </Button>
        <Button variant="outline">
          <Search className="mr-2 h-4 w-4" />
          {t('dashboard.search') || 'Search'}
          <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            Ctrl+K
          </kbd>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/spaces">
            <Layers className="mr-2 h-4 w-4" />
            {t('dashboard.browseSpaces')}
          </Link>
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Pages — left 2/3 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t('dashboard.recentPages')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {recentItems.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">{t('dashboard.noRecentPages')}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentItems.map((item) => (
                    <Link
                      key={item.id}
                      href={`/spaces/${item.page.space.slug}/pages/${item.page.id}`}
                      className="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/50 group"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">{item.page.title}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground dark:bg-muted/50">
                            {item.page.space.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {timeAgo(item.visitedAt, t)}
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Favorites — right 1/3 */}
        <div>
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4" />
                {t('dashboard.favorites')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {favoriteItems.length === 0 ? (
                <div className="text-center py-8">
                  <Star className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">{t('dashboard.noFavorites')}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {favoriteItems.map((item) => (
                    <Link
                      key={item.id}
                      href={`/spaces/${item.page.space.slug}/pages/${item.page.id}`}
                      className="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/50 group"
                    >
                      <Star className="h-4 w-4 text-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">{item.page.title}</span>
                        <span className="text-xs text-muted-foreground">{item.page.space.name}</span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
