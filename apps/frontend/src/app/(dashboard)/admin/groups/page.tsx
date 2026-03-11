'use client';

import { useState } from 'react';
import {
  UsersRound,
  Search,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  UserPlus,
  X,
} from 'lucide-react';
import {
  useGroups,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useGroupMembers,
  useAddGroupMember,
  useRemoveGroupMember,
} from '@/hooks/useGroups';
import { useAdminUsers } from '@/hooks/useAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/useTranslation';

const PAGE_SIZE = 20;

function GroupMembersPanel({ groupId }: { groupId: string }) {
  const { t } = useTranslation();
  const { data: members, isLoading } = useGroupMembers(groupId);
  const removeMember = useRemoveGroupMember(groupId);
  const addMember = useAddGroupMember(groupId);
  const [memberSearch, setMemberSearch] = useState('');
  const { data: searchUsers } = useAdminUsers(0, 10, { search: memberSearch || undefined });

  const memberUserIds = new Set(members?.map((m) => m.user.id) || []);
  const filteredUsers = searchUsers?.filter((u: any) => !memberUserIds.has(u.id)) || [];

  return (
    <div className="border-t border-border px-6 py-4 bg-muted/30">
      <div className="mb-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('admin.groups.searchUsersToAdd')}
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
      </div>

      {/* Search results to add */}
      {memberSearch && filteredUsers.length > 0 && (
        <div className="mb-3 rounded-md border border-border bg-background">
          {filteredUsers.slice(0, 5).map((user: any) => (
            <div
              key={user.id}
              className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer"
              onClick={() => {
                addMember.mutate(user.id);
                setMemberSearch('');
              }}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {user.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <span>{user.name}</span>
                <span className="text-muted-foreground">{user.email}</span>
              </div>
              <UserPlus className="h-4 w-4 text-primary" />
            </div>
          ))}
        </div>
      )}

      {/* Current members */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : members && members.length > 0 ? (
        <div className="space-y-1">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted/50">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {m.user.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <span className="font-medium">{m.user.name}</span>
                <span className="text-muted-foreground">{m.user.email}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeMember.mutate(m.user.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('admin.groups.noMembers')}</p>
      )}
    </div>
  );
}

export default function AdminGroupsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');

  // Edit dialog
  const [editGroup, setEditGroup] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const { data, isLoading } = useGroups(page * PAGE_SIZE, PAGE_SIZE, search || undefined);
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();

  const groups = data?.groups || [];
  const total = data?.total || 0;

  const handleCreate = () => {
    if (!createName.trim()) return;
    createGroup.mutate(
      { name: createName.trim(), description: createDescription.trim() || undefined },
      {
        onSuccess: () => {
          setCreateName('');
          setCreateDescription('');
          setShowCreate(false);
        },
      },
    );
  };

  const handleEditSave = () => {
    if (!editGroup || !editName.trim()) return;
    updateGroup.mutate(
      { id: editGroup.id, name: editName.trim(), description: editDescription.trim() || undefined },
      { onSuccess: () => setEditGroup(null) },
    );
  };

  const openEditDialog = (group: any) => {
    setEditGroup(group);
    setEditName(group.name);
    setEditDescription(group.description || '');
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UsersRound className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">{t('admin.groups.title')}</h1>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('admin.groups.createGroup')}
        </Button>
      </div>

      {/* Create Group Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.groups.createGroup')}</DialogTitle>
            <DialogDescription>{t('admin.groups.createGroupDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{t('common.name')}</Label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={t('admin.groups.namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('common.description')}</Label>
              <Input
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder={t('admin.groups.descriptionPlaceholder')}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
              <Button
                onClick={handleCreate}
                disabled={!createName.trim() || createGroup.isPending}
              >
                {createGroup.isPending ? t('common.creating') : t('admin.groups.createGroup')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={!!editGroup} onOpenChange={(open) => !open && setEditGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.groups.editGroup')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{t('common.name')}</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('common.description')}</Label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditGroup(null)}>{t('common.cancel')}</Button>
              <Button
                onClick={handleEditSave}
                disabled={!editName.trim() || updateGroup.isPending}
              >
                {t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('admin.groups.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
      </div>

      {/* Groups Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">{t('admin.groups.noGroups')}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 font-medium text-muted-foreground">{t('common.name')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('common.description')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.groups.memberCount')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group: any) => (
                      <>
                        <tr
                          key={group.id}
                          className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/30"
                          onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                        >
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              {expandedGroup === group.id ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="font-medium">{group.name}</span>
                            </div>
                          </td>
                          <td className="py-3 text-muted-foreground">{group.description || '—'}</td>
                          <td className="py-3">
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                              {group._count?.members || 0}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title={t('admin.groups.editGroup')}
                                onClick={() => openEditDialog(group)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                title={t('admin.groups.deleteGroup')}
                                onClick={() => {
                                  if (confirm(t('admin.groups.confirmDelete'))) {
                                    deleteGroup.mutate(group.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {expandedGroup === group.id && (
                          <tr key={`${group.id}-members`}>
                            <td colSpan={4} className="p-0">
                              <GroupMembersPanel groupId={group.id} />
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {total > PAGE_SIZE && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {t('common.showing', { from: page * PAGE_SIZE + 1, to: page * PAGE_SIZE + groups.length })}
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
                      disabled={(page + 1) * PAGE_SIZE >= total}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
