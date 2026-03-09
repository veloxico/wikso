'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { Plus, Globe, Lock, User, Search, SlidersHorizontal, Users, FileText, Clock } from 'lucide-react';
import { useSpaces } from '@/hooks/useSpaces';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const spaceTypeIcon: Record<string, React.ElementType> = {
  PUBLIC: Globe,
  PRIVATE: Lock,
  PERSONAL: User,
};

const spaceTypeLabel: Record<string, string> = {
  PUBLIC: 'Public',
  PRIVATE: 'Private',
  PERSONAL: 'Personal',
};

type SortOption = 'name' | 'updated' | 'created';
type FilterType = 'all' | 'PUBLIC' | 'PRIVATE' | 'PERSONAL';

export default function SpacesPage() {
  const { data: spaces, isLoading, error } = useSpaces();
  const { t, locale } = useTranslation();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredSpaces = useMemo(() => {
    if (!spaces) return [];

    let result = [...spaces];

    // Search filter
    if (search) {
      const query = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          (s.description && s.description.toLowerCase().includes(query)) ||
          s.slug.toLowerCase().includes(query),
      );
    }

    // Type filter
    if (filterType !== 'all') {
      result = result.filter((s) => s.type === filterType);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'updated') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [spaces, search, filterType, sortBy]);

  const typeCounts = useMemo(() => {
    if (!spaces) return { all: 0, PUBLIC: 0, PRIVATE: 0, PERSONAL: 0 };
    return {
      all: spaces.length,
      PUBLIC: spaces.filter((s) => s.type === 'PUBLIC').length,
      PRIVATE: spaces.filter((s) => s.type === 'PRIVATE').length,
      PERSONAL: spaces.filter((s) => s.type === 'PERSONAL').length,
    };
  }, [spaces]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('spaces.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('spaces.subtitle')}
            {spaces && <span className="ml-1">({spaces.length})</span>}
          </p>
        </div>
        <Link href="/spaces/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            {t('spaces.newSpace')}
          </Button>
        </Link>
      </div>

      {/* Search & Filter bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('spaces.searchPlaceholder') || 'Search spaces...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Type filter pills */}
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
            {(['all', 'PUBLIC', 'PRIVATE', 'PERSONAL'] as FilterType[]).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  filterType === type
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                {type === 'all' ? t('common.all') || 'All' : spaceTypeLabel[type]}
                <span className="ml-1 opacity-60">{typeCounts[type]}</span>
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs"
          >
            <option value="updated">{t('spaces.sortUpdated') || 'Last updated'}</option>
            <option value="name">{t('spaces.sortName') || 'Name'}</option>
            <option value="created">{t('spaces.sortCreated') || 'Date created'}</option>
          </select>

          {/* View toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'px-2.5 py-1.5 text-xs',
                viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 rotate-90" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'px-2.5 py-1.5 text-xs',
                viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 w-32 rounded bg-muted" />
                <div className="mt-2 h-4 w-48 rounded bg-muted" />
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {t('spaces.loadFailed')}
        </div>
      )}

      {/* Empty state */}
      {spaces && spaces.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Globe className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">{t('spaces.noSpaces')}</h3>
          <p className="mb-4 text-muted-foreground">{t('spaces.noSpacesDescription')}</p>
          <Link href="/spaces/new">
            <Button>{t('spaces.createSpace')}</Button>
          </Link>
        </div>
      )}

      {/* No search results */}
      {spaces && spaces.length > 0 && filteredSpaces.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <Search className="mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {t('spaces.noResults') || 'No spaces match your search'}
          </p>
          <button
            onClick={() => {
              setSearch('');
              setFilterType('all');
            }}
            className="mt-2 text-sm text-primary hover:underline"
          >
            {t('common.clearFilters') || 'Clear filters'}
          </button>
        </div>
      )}

      {/* Grid view */}
      {filteredSpaces.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSpaces.map((space) => {
            const Icon = spaceTypeIcon[space.type] || Globe;
            return (
              <Link key={space.id} href={`/spaces/${space.slug}`}>
                <Card className="cursor-pointer transition-all hover:bg-accent/50 hover:shadow-md group h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <CardTitle className="text-base">{space.name}</CardTitle>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
                        {spaceTypeLabel[space.type]}
                      </span>
                    </div>
                    {space.description && (
                      <CardDescription className="line-clamp-2 mt-1">{space.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {space.owner && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {space.owner.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(space.updatedAt).toLocaleDateString(locale)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* List view */}
      {filteredSpaces.length > 0 && viewMode === 'list' && (
        <div className="space-y-2">
          {filteredSpaces.map((space) => {
            const Icon = spaceTypeIcon[space.type] || Globe;
            return (
              <Link key={space.id} href={`/spaces/${space.slug}`}>
                <div className="flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-accent/50 cursor-pointer">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{space.name}</h3>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium shrink-0">
                        {spaceTypeLabel[space.type]}
                      </span>
                    </div>
                    {space.description && (
                      <p className="text-sm text-muted-foreground truncate">{space.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                    {space.owner && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {space.owner.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(space.updatedAt).toLocaleDateString(locale)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
