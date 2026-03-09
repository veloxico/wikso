'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Trash2, RotateCcw, AlertTriangle, FileText, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useAdminTrash, useAdminRestorePage, useAdminPermanentDelete } from '@/hooks/useAdmin';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const PAGE_SIZE = 20;

export default function AdminTrashPage() {
  const { t, locale } = useTranslation();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const { data, isLoading } = useAdminTrash(page * PAGE_SIZE, PAGE_SIZE, search || undefined);
  const restorePage = useAdminRestorePage();
  const permanentDelete = useAdminPermanentDelete();

  const pages = data?.pages ?? [];
  const total = data?.total ?? 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
  };

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <Trash2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('admin.trash.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('admin.trash.description')}</p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('admin.trash.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">
          {t('common.search')}
        </Button>
      </form>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : pages.length === 0 ? (
            <div className="py-12 text-center">
              <Trash2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{t('admin.trash.empty')}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.trash.pageColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.trash.spaceColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.trash.deletedByColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.trash.deletedAtColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pages.map((page: any) => (
                      <tr key={page.id} className="border-b border-border last:border-0">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate max-w-[250px]">{page.title}</span>
                          </div>
                        </td>
                        <td className="py-3">
                          {page.space ? (
                            <Link
                              href={`/spaces/${page.space.slug}`}
                              className="text-sm text-primary hover:underline"
                            >
                              {page.space.name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {page.author?.name || '—'}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {page.deletedAt
                            ? new Date(page.deletedAt).toLocaleDateString(locale, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => restorePage.mutate(page.id)}
                              disabled={restorePage.isPending}
                              title={t('admin.trash.restore')}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (window.confirm(t('admin.trash.confirmPermanentDelete'))) {
                                  permanentDelete.mutate(page.id);
                                }
                              }}
                              disabled={permanentDelete.isPending}
                              title={t('admin.trash.deletePermanently')}
                            >
                              <AlertTriangle className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {total} {t('admin.trash.totalPages', { count: total })}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pages.length < PAGE_SIZE}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
