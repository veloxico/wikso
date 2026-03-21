'use client';

import { useState } from 'react';
import { FolderOpen, Trash2, ChevronLeft, ChevronRight, Search, Pencil } from 'lucide-react';
import { useAdminSpaces, useDeleteAdminSpace, useUpdateAdminSpace, useAdminUsers } from '@/hooks/useAdmin';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/useTranslation';

const PAGE_SIZE = 10;

const SPACE_TYPES = ['ALL', 'PUBLIC', 'PRIVATE', 'PERSONAL'] as const;

export default function AdminSpacesPage() {
  const { t, locale } = useTranslation();
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [editingSpace, setEditingSpace] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', type: '', ownerId: '' });

  const filters = {
    ...(search ? { search } : {}),
    ...(typeFilter !== 'ALL' ? { type: typeFilter } : {}),
  };
  const { data: spaces, isLoading } = useAdminSpaces(page * PAGE_SIZE, PAGE_SIZE, filters);
  const deleteSpace = useDeleteAdminSpace();
  const updateSpace = useUpdateAdminSpace();
  const { data: users } = useAdminUsers(0, 200);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
  };

  const handleTypeFilter = (type: string) => {
    setTypeFilter(type);
    setPage(0);
  };

  const openEditDialog = (space: any) => {
    setEditingSpace(space);
    setEditForm({
      name: space.name || '',
      description: space.description || '',
      type: space.type || 'PUBLIC',
      ownerId: space.owner?.id || space.ownerId || '',
    });
  };

  const handleEditSave = () => {
    if (!editingSpace) return;
    updateSpace.mutate(
      {
        spaceId: editingSpace.id,
        name: editForm.name,
        description: editForm.description,
        type: editForm.type,
        ownerId: editForm.ownerId,
      },
      {
        onSuccess: () => setEditingSpace(null),
      },
    );
  };

  return (
    <div>
      <div className="mb-4 sm:mb-8 flex items-center gap-3">
        <FolderOpen className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
        <h1 className="text-xl sm:text-2xl font-bold">{t('admin.spaces.title')}</h1>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('admin.spaces.searchPlaceholder', { fallback: 'Search by name or slug...' })}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">
          {t('common.search')}
        </Button>
      </form>

      {/* Type filter pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {SPACE_TYPES.map((type) => (
          <Button
            key={type}
            variant={typeFilter === type ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleTypeFilter(type)}
          >
            {type === 'ALL'
              ? t('common.all', { fallback: 'All' })
              : type === 'PUBLIC'
                ? t('common.public')
                : type === 'PRIVATE'
                  ? t('common.private')
                  : t('common.personal')}
          </Button>
        ))}
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
                            {space.type === 'PUBLIC'
                              ? t('common.public')
                              : space.type === 'PRIVATE'
                                ? t('common.private')
                                : t('common.personal')}
                          </span>
                        </td>
                        <td className="py-3 text-muted-foreground">{space.owner?.name || '—'}</td>
                        <td className="py-3 text-muted-foreground">{space._count?.pages ?? 0}</td>
                        <td className="py-3 text-muted-foreground">
                          {new Date(space.createdAt).toLocaleDateString(locale)}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => openEditDialog(space)}
                              title={t('common.edit', { fallback: 'Edit' })}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
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
                          </div>
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
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!spaces || spaces.length < PAGE_SIZE}
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

      {/* Edit Space Dialog */}
      <Dialog open={!!editingSpace} onOpenChange={(open) => !open && setEditingSpace(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.spaces.editSpace', { fallback: 'Edit Space' })}</DialogTitle>
            <DialogDescription>
              {t('admin.spaces.editSpaceDescription', { fallback: 'Update space settings and transfer ownership.' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t('admin.spaces.nameColumn')}</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">{t('admin.spaces.descriptionLabel', { fallback: 'Description' })}</Label>
              <Input
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.spaces.typeColumn')}</Label>
              <Select value={editForm.type} onValueChange={(val) => setEditForm((f) => ({ ...f, type: val }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">{t('common.public')}</SelectItem>
                  <SelectItem value="PRIVATE">{t('common.private')}</SelectItem>
                  <SelectItem value="PERSONAL">{t('common.personal')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('admin.spaces.ownerColumn')}</Label>
              <Select value={editForm.ownerId} onValueChange={(val) => setEditForm((f) => ({ ...f, ownerId: val }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('admin.spaces.selectOwner', { fallback: 'Select owner' })} />
                </SelectTrigger>
                <SelectContent>
                  {(users ?? []).map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSpace(null)}>
              {t('common.cancel', { fallback: 'Cancel' })}
            </Button>
            <Button onClick={handleEditSave} disabled={updateSpace.isPending}>
              {t('common.save', { fallback: 'Save' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
