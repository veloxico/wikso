'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, Globe, X, Loader2, ArrowRight } from 'lucide-react';
import { useGlobalSearch } from '@/hooks/useSearch';
import { useTranslation } from '@/hooks/useTranslation';

/* ─── Standalone modal (used from sidebar icon) ─── */

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { data, isLoading } = useGlobalSearch(query);
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const allItems: { type: 'space' | 'page'; id: string; href: string }[] = [];
  if (data?.spaces) {
    data.spaces.forEach((s) => allItems.push({ type: 'space', id: s.id, href: `/spaces/${s.slug}` }));
  }
  if (data?.pages) {
    data.pages.forEach((p) => allItems.push({ type: 'page', id: p.id, href: `/spaces/${p.spaceSlug || ''}/pages/${p.id}` }));
  }

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => { setSelectedIndex(0); }, [data]);

  const close = useCallback(() => { onOpenChange(false); setQuery(''); }, [onOpenChange]);

  const navigate = useCallback((path: string) => { router.push(path); close(); }, [router, close]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((p) => Math.min(p + 1, allItems.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((p) => Math.max(p - 1, 0)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems.length > 0 && allItems[selectedIndex]) navigate(allItems[selectedIndex].href);
      else if (query.length >= 2) navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  }, [allItems, selectedIndex, query, navigate, close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={close} />
      <div className="fixed left-1/2 top-[15%] w-full max-w-xl -translate-x-1/2">
        <div className="rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden">
          <div className="flex items-center border-b border-border px-4">
            <Search className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('search.quickPlaceholder') || t('search.placeholder')}
              className="flex h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <SearchResults data={data} isLoading={isLoading} query={query} selectedIndex={selectedIndex} navigate={navigate} t={t} />
        </div>
      </div>
    </div>
  );
}

/* ─── Top bar search (Confluence-style) ─── */

export function TopSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const { data, isLoading } = useGlobalSearch(query);
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const allItems: { type: 'space' | 'page'; id: string; href: string }[] = [];
  if (data?.spaces) {
    data.spaces.forEach((s) => allItems.push({ type: 'space', id: s.id, href: `/spaces/${s.slug}` }));
  }
  if (data?.pages) {
    data.pages.forEach((p) => allItems.push({ type: 'page', id: p.id, href: `/spaces/${p.spaceSlug || ''}/pages/${p.id}` }));
  }

  useEffect(() => { setSelectedIndex(0); }, [data]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Ctrl/Cmd+K shortcut to focus search
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
        setFocused(true);
      }
    }
    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const close = useCallback(() => {
    setFocused(false);
  }, []);

  const navigate = useCallback((path: string) => {
    router.push(path);
    setFocused(false);
    setQuery('');
    inputRef.current?.blur();
  }, [router]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      inputRef.current?.blur();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((p) => Math.min(p + 1, allItems.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((p) => Math.max(p - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems.length > 0 && allItems[selectedIndex]) {
        navigate(allItems[selectedIndex].href);
      } else if (query.length >= 2) {
        navigate(`/search?q=${encodeURIComponent(query)}`);
      }
    }
  }, [allItems, selectedIndex, query, navigate, close]);

  const showDropdown = focused && query.length >= 1;

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      {/* Search input bar */}
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={t('search.quickPlaceholder') || t('search.placeholder')}
          className="h-9 w-full rounded-lg border border-border bg-muted/50 pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background focus:ring-1 focus:ring-primary/20"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            className="absolute right-3 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {isLoading && (
          <Loader2 className="absolute right-3 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Dropdown results */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden">
          <SearchResults data={data} isLoading={isLoading} query={query} selectedIndex={selectedIndex} navigate={navigate} t={t} />
        </div>
      )}
    </div>
  );
}

/* ─── Shared results dropdown content ─── */

interface SearchResultsProps {
  data: { pages: any[]; spaces: any[] } | undefined;
  isLoading: boolean;
  query: string;
  selectedIndex: number;
  navigate: (path: string) => void;
  t: (key: string) => string;
}

function SearchResults({ data, isLoading, query, selectedIndex, navigate, t }: SearchResultsProps) {
  const hasResults = (data?.spaces?.length || 0) + (data?.pages?.length || 0) > 0;
  const showEmpty = query.length >= 2 && !isLoading && !hasResults;

  return (
    <div className="max-h-80 overflow-y-auto">
      {/* Empty state */}
      {showEmpty && (
        <div className="py-6 text-center text-sm text-muted-foreground">
          {t('search.noResults')}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && query.length >= 2 && !hasResults && (
        <div className="p-2 space-y-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-md px-3 py-2">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded bg-muted" />
                <div className="h-4 w-32 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Spaces */}
      {data?.spaces && data.spaces.length > 0 && (
        <div className="p-1.5">
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('search.spaces')}
          </div>
          {data.spaces.map((space, idx) => (
            <button
              key={space.id}
              onClick={() => navigate(`/spaces/${space.slug}`)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent ${
                selectedIndex === idx ? 'bg-accent' : ''
              }`}
            >
              <Globe className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="truncate font-medium">{space.name}</span>
              <span className="ml-auto text-[11px] text-muted-foreground capitalize">{space.type?.toLowerCase()}</span>
            </button>
          ))}
        </div>
      )}

      {/* Pages */}
      {data?.pages && data.pages.length > 0 && (
        <div className="p-1.5">
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('search.pages')}
          </div>
          {data.pages.map((page, idx) => {
            const itemIdx = (data?.spaces?.length || 0) + idx;
            return (
              <button
                key={page.id}
                onClick={() => navigate(`/spaces/${page.spaceSlug || ''}/pages/${page.id}`)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent ${
                  selectedIndex === itemIdx ? 'bg-accent' : ''
                }`}
              >
                <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                <div className="flex flex-col items-start truncate">
                  <span className="truncate font-medium">{page.title}</span>
                  {page.spaceName && (
                    <span className="text-[11px] text-muted-foreground">{page.spaceName}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Show all footer */}
      {query.length >= 2 && hasResults && (
        <div className="border-t border-border">
          <button
            onClick={() => navigate(`/search?q=${encodeURIComponent(query)}`)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <span>{t('search.showAll')}</span>
            <div className="flex items-center gap-1.5 text-xs">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">Enter</kbd>
              <ArrowRight className="h-3 w-3" />
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
