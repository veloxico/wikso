'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { Plus, Globe, Lock, User, Search, LayoutGrid, List, Users, Clock, FolderOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSpaces } from '@/hooks/useSpaces';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { bcp47Locale } from '@/lib/locale';

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

const ease = [0.22, 0.68, 0, 1.04] as const;

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
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <motion.div
        className="mb-8 flex items-end justify-between gap-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
      >
        <div>
          <h1 className="text-[1.75rem] font-bold tracking-[-0.02em]">{t('spaces.title')}</h1>
          <p className="text-sm text-muted-foreground/70 mt-1">
            {t('spaces.subtitle')}
            {spaces && <span className="ml-1 text-muted-foreground/50">({spaces.length})</span>}
          </p>
        </div>
        <Link href="/spaces/new">
          <Button className="gap-2 shadow-md shadow-primary/15 hover:shadow-lg hover:shadow-primary/20 transition-shadow">
            <Plus className="h-4 w-4" />
            {t('spaces.newSpace')}
          </Button>
        </Link>
      </motion.div>

      {/* Search & Filter bar */}
      <motion.div
        className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease }}
      >
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            placeholder={t('spaces.searchPlaceholder') || 'Search spaces...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-muted/30 border-border/60 focus-visible:bg-background"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Type filter pills */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/20 p-0.5">
            {(['all', 'PUBLIC', 'PRIVATE', 'PERSONAL'] as FilterType[]).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  'relative rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200',
                  filterType === type
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground/70 hover:text-foreground',
                )}
              >
                {type === 'all' ? t('common.all') || 'All' : spaceTypeLabel[type]}
                <span className={cn(
                  'ml-1 transition-colors',
                  filterType === type ? 'text-primary' : 'text-muted-foreground/40',
                )}>
                  {typeCounts[type]}
                </span>
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-9 rounded-lg border border-border/60 bg-muted/20 px-3 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="updated">{t('spaces.sortUpdated') || 'Last updated'}</option>
            <option value="name">{t('spaces.sortName') || 'Name'}</option>
            <option value="created">{t('spaces.sortCreated') || 'Date created'}</option>
          </select>

          {/* View toggle */}
          <div className="flex rounded-lg border border-border/60 bg-muted/20 overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'px-2.5 py-1.5 transition-all duration-200',
                viewMode === 'grid'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground/50 hover:text-foreground',
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'px-2.5 py-1.5 transition-all duration-200',
                viewMode === 'list'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground/50 hover:text-foreground',
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-border/40 bg-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-muted/60" />
                <div className="h-4 w-28 rounded-md bg-muted/60" />
              </div>
              <div className="h-3 w-full rounded bg-muted/40 mb-2" />
              <div className="h-3 w-2/3 rounded bg-muted/40" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5">
          <p className="text-sm text-destructive">{t('spaces.loadFailed')}</p>
        </div>
      )}

      {/* Empty state */}
      {spaces && spaces.length === 0 && (
        <motion.div
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-20"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/8 mb-5">
            <FolderOpen className="h-8 w-8 text-primary/60" />
          </div>
          <h3 className="text-lg font-semibold tracking-[-0.01em]">{t('spaces.noSpaces')}</h3>
          <p className="mb-6 text-sm text-muted-foreground/60 max-w-sm text-center mt-1">{t('spaces.noSpacesDescription')}</p>
          <Link href="/spaces/new">
            <Button className="gap-2">{t('spaces.createSpace')}</Button>
          </Link>
        </motion.div>
      )}

      {/* No search results */}
      {spaces && spaces.length > 0 && filteredSpaces.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-16">
          <Search className="mb-3 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground/60">
            {t('spaces.noResults') || 'No spaces match your search'}
          </p>
          <button
            onClick={() => { setSearch(''); setFilterType('all'); }}
            className="mt-2 text-sm text-primary/80 hover:text-primary transition-colors"
          >
            {t('common.clearFilters') || 'Clear filters'}
          </button>
        </div>
      )}

      {/* Grid view */}
      {filteredSpaces.length > 0 && viewMode === 'grid' && (
        <motion.div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.04 } },
          }}
        >
          {filteredSpaces.map((space) => {
            const Icon = spaceTypeIcon[space.type] || Globe;
            return (
              <motion.div
                key={space.id}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease } },
                }}
              >
                <Link href={`/spaces/${space.slug}`}>
                  <div className="group relative rounded-xl border border-border/50 bg-card p-5 transition-all duration-200 hover:border-border hover:shadow-[var(--shadow-card-hover)] cursor-pointer h-full">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8 text-primary group-hover:bg-primary/12 transition-colors">
                          <Icon className="h-[18px] w-[18px]" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-[15px] tracking-[-0.01em] truncate group-hover:text-primary transition-colors">
                            {space.name}
                          </h3>
                        </div>
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground/40 font-medium mt-1 shrink-0">
                        {spaceTypeLabel[space.type]}
                      </span>
                    </div>

                    {/* Description */}
                    {space.description && (
                      <p className="text-[13px] text-muted-foreground/60 line-clamp-2 mb-4 leading-relaxed">
                        {space.description}
                      </p>
                    )}

                    {/* Footer meta */}
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground/40 mt-auto pt-3 border-t border-border/40">
                      {space.owner && (
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3 w-3" />
                          {space.owner.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {new Date(space.updatedAt).toLocaleDateString(bcp47Locale(locale))}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* List view */}
      {filteredSpaces.length > 0 && viewMode === 'list' && (
        <motion.div
          className="space-y-1.5"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.03 } },
          }}
        >
          {filteredSpaces.map((space) => {
            const Icon = spaceTypeIcon[space.type] || Globe;
            return (
              <motion.div
                key={space.id}
                variants={{
                  hidden: { opacity: 0, x: -8 },
                  visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease } },
                }}
              >
                <Link href={`/spaces/${space.slug}`}>
                  <div className="group flex items-center gap-4 rounded-xl border border-border/40 bg-card p-4 transition-all duration-200 hover:border-border hover:shadow-[var(--shadow-card)] cursor-pointer">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8 text-primary group-hover:bg-primary/12 transition-colors shrink-0">
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-[15px] tracking-[-0.01em] truncate group-hover:text-primary transition-colors">
                          {space.name}
                        </h3>
                        <span className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground/40 font-medium shrink-0">
                          {spaceTypeLabel[space.type]}
                        </span>
                      </div>
                      {space.description && (
                        <p className="text-[13px] text-muted-foreground/50 truncate mt-0.5">{space.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground/40 shrink-0">
                      {space.owner && (
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3 w-3" />
                          {space.owner.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {new Date(space.updatedAt).toLocaleDateString(bcp47Locale(locale))}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
