'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search as SearchIcon, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useSearch } from '@/hooks/useSearch';
import { useTranslation } from '@/hooks/useTranslation';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const { data: results, isLoading } = useSearch({ q: query });
  const { t, locale } = useTranslation();

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-3xl font-bold">{t('search.title')}</h1>

      <div className="relative mb-8">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search.placeholder')}
          className="pl-10"
          autoFocus
        />
      </div>

      {isLoading && query.length >= 2 && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-border p-4">
              <div className="h-5 w-48 rounded bg-muted" />
              <div className="mt-2 h-4 w-72 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {results && results.length === 0 && query.length >= 2 && (
        <div className="py-16 text-center">
          <SearchIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-medium">{t('search.noResults')}</p>
          <p className="text-muted-foreground">{t('search.noResultsHint')}</p>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-3">
          {results.map((result) => (
            <Link
              key={result.id}
              href={`/spaces/${result.spaceSlug || ''}/pages/${result.id}`}
              className="block rounded-lg border border-border p-4 transition-colors hover:bg-accent/50"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{result.title}</span>
              </div>
              {result.excerpt && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{result.excerpt}</p>
              )}
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                {result.spaceName && <span>{result.spaceName}</span>}
                <span>·</span>
                <span>{new Date(result.updatedAt).toLocaleDateString(locale)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!query && (
        <div className="py-16 text-center">
          <SearchIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">{t('search.startTyping')}</p>
        </div>
      )}
    </div>
  );
}
