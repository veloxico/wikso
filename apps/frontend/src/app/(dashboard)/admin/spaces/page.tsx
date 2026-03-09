'use client';

import { useState } from 'react';
import { FolderOpen, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAdminSpaces, useDeleteAdminSpace } from '@/hooks/useAdmin';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';

const PAGE_SIZE = 10;

export default function AdminSpacesPage() {
  const { t, locale } = useTranslation();
  const [page, setPage] = useState(0);
  const { data: spaces, isLoading } = useAdminSpaces(page * PAGE_SIZE, PAGE_SIZE);
  const deleteSpace = useDeleteAdminSpace();

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <FolderOpen className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">{t('admin.spaces.title')}</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.spaces.nameColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.spaces.slugColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.spaces.typeColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.spaces.ownerColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.spaces.pagesColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.spaces.createdColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.spaces.actionsColumn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spaces?.map((space: any) => (
                      <tr key={space.id} className="border-b border-border last:border-0">
                        <td className="py-3 font-medium">{space.name}</td>
                        <td className="py-3 text-muted-foreground font-mono text-xs">{space.slug}</td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              space.type === 'PUBLIC'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : space.type === 'PRIVATE'
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                            }`}
                          >
                            {space.type === 'PUBLIC' ? t('common.public') : space.type === 'PRIVATE' ? t('common.private') : t('common.personal')}
                          </span>
                        </td>
                        <td className="py-3 text-muted-foreground">{space.owner?.name || '—'}</td>
                        <td className="py-3 text-muted-foreground">{space._count?.pages ?? 0}</td>
                        <td className="py-3 text-muted-foreground">
                          {new Date(space.createdAt).toLocaleDateString(locale)}
                        </td>
                        <td className="py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(t('admin.spaces.confirmDelete', { name: space.name }))) {
                                deleteSpace.mutate(space.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t('common.pageNum', { num: page + 1 })}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={!spaces || spaces.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>
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
