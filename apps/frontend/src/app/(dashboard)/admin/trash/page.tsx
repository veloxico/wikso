'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileText,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import {
  useAdminTrash,
  useAdminRestorePage,
  useAdminPermanentDelete,
  useBulkRestore,
  useBulkDelete,
  useAdminSpaces,
} from '@/hooks/useAdmin';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PAGE_SIZE = 20;

export default function AdminTrashPage() {
  const { t, locale } = useTranslation();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [spaceFilter, setSpaceFilter] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useAdminTrash(
    page * PAGE_SIZE,
    PAGE_SIZE,
    search || undefined,
    spaceFilter || undefined,
  );
  const restorePage = useAdminRestorePage();
  const permanentDelete = useAdminPermanentDelete();
  const bulkRestore = useBulkRestore();
  const bulkDeleteMut = useBulkDelete();
  const { data: allSpaces } = useAdminSpaces(0, 200);

  const pages = data?.pages ?? [];
  const total = data?.total ?? 0;

  const allSelected = pages.length > 0 && pages.every((p: any) => selectedIds.has(p.id));

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
    setSelectedIds(new Set());
  };

  const handleSpaceFilter = (val: string) => {
    setSpaceFilter(val === 'ALL' ? '' : val);
    setPage(0);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pages.map((p: any) => p.id)));
    }
  };

  const handleBulkRestore = () => {
    const ids = Array.from(selectedIds);
    bulkRestore.mutate(ids, {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  const handleBulkDelete = () => {
    if (!window.confirm(t('admin.trash.confirmBulkDelete', { fallback: 'Permanently delete all selected pages? This cannot be undone.' }))) {
      return;
    }
    const ids = Array.from(selectedIds);
    bulkDeleteMut.mutate(ids, {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  return (
    <div>
      <div className="mb-4 sm:mb-8 flex items-center gap-3">
        <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <Trash2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t('admin.trash.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('admin.trash.description')}</p>
        </div>
      </div>

      {/* Search + Space filter */}
      <div className="mb-4 flex gap-2 flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-0">
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
        <Select value={spaceFilter || 'ALL'} onValueChange={handleSpaceFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={t('admin.trash.filterBySpace', { fallback: 'Filter by space' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('common.all', { fallback: 'All spaces' })}</SelectItem>
            {(allSpaces ?? []).map((space: any) => (
              <SelectItem key={space.id} value={space.id}>
                {space.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 sm:px-4 sm:gap-3">
          <span className="text-sm font-medium">
            {selectedIds.size} {t('admin.trash.selected', { fallback: 'selected' })}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleBulkRestore}
            disabled={bulkRestore.isPending}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {t('admin.trash.restoreSelected', { fallback: 'Restore Selected' })} ({selectedIds.size})
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleBulkDelete}
            disabled={bulkDeleteMut.isPending}
          >
            <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
            {t('admin.trash.deleteSelected', { fallback: 'Delete Selected' })} ({selectedIds.size})
          </Button>
        </div>
      )}

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
                      <th className="pb-3 pr-2">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-border"
                        />
                      </th>
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
                        <td className="py-3 pr-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(page.id)}
                            onChange={() => toggleSelect(page.id)}
                            className="h-4 w-4 rounded border-border"
                          />
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate max-w-[150px] sm:max-w-[250px]">{page.title}</span>
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
                    onClick={() => { setPage((p) => p - 1); setSelectedIds(new Set()); }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pages.length < PAGE_SIZE}
                    onClick={() => { setPage((p) => p + 1); setSelectedIds(new Set()); }}
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
