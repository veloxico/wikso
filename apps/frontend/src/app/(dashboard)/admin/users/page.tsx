'use client';

import { useState, useMemo } from 'react';
import {
  Users,
  Search,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Ban,
  CheckCircle2,
  Pencil,
  Plus,
  X,
  Shield,
} from 'lucide-react';
import {
  useAdminUsers,
  useUpdateUserRole,
  useDeleteUser,
  useSuspendUser,
  useActivateUser,
  useInviteUser,
  useCreateUser,
  useUpdateUser,
  useSetUserPassword,
  useBulkSuspendUsers,
  useBulkDeleteUsers,
} from '@/hooks/useAdmin';
import type { AdminUser } from '@/hooks/useAdmin';
import { useUserGroups, useSearchGroups, useAddUserToGroup, useRemoveUserFromGroup } from '@/hooks/useGroups';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/useTranslation';

const PAGE_SIZE = 10;

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export default function AdminUsersPage() {
  const { t, locale } = useTranslation();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('USER');
  const [inviteName, setInviteName] = useState('');

  // Create user dialog
  const [showCreate, setShowCreate] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createName, setCreateName] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createConfirmPassword, setCreateConfirmPassword] = useState('');
  const [createRole, setCreateRole] = useState('USER');

  // Edit user dialog
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editConfirmPassword, setEditConfirmPassword] = useState('');

  // Group management in edit dialog
  const [groupSearch, setGroupSearch] = useState('');
  const { data: userGroups } = useUserGroups(editUser?.id || '');
  const { data: searchedGroups } = useSearchGroups(groupSearch);
  const addUserToGroup = useAddUserToGroup();
  const removeUserFromGroup = useRemoveUserFromGroup();

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filters = {
    search: search || undefined,
    role: roleFilter || undefined,
    status: statusFilter || undefined,
  };

  const { data: users, isLoading } = useAdminUsers(page * PAGE_SIZE, PAGE_SIZE, filters);
  const updateRole = useUpdateUserRole();
  const deleteUser = useDeleteUser();
  const suspendUser = useSuspendUser();
  const activateUser = useActivateUser();
  const inviteUser = useInviteUser();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const setUserPassword = useSetUserPassword();
  const bulkSuspend = useBulkSuspendUsers();
  const bulkDelete = useBulkDeleteUsers();

  // Non-admin users that can be selected for bulk actions
  const selectableUsers = useMemo(
    () => (users ?? []).filter((u: AdminUser) => u.role !== 'ADMIN'),
    [users],
  );

  const allSelectableSelected =
    selectableUsers.length > 0 && selectableUsers.every((u: AdminUser) => selectedIds.has(u.id));

  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableUsers.map((u: AdminUser) => u.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkSuspend = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    bulkSuspend.mutate(ids, {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(t('admin.users.confirmBulkDelete', { count: ids.length }))) return;
    bulkDelete.mutate(ids, {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    inviteUser.mutate(
      { email: inviteEmail.trim(), role: inviteRole, name: inviteName.trim() || undefined },
      {
        onSuccess: () => {
          setInviteEmail('');
          setInviteName('');
          setShowInvite(false);
        },
      },
    );
  };

  const handleCreate = () => {
    if (!createEmail.trim() || !createName.trim() || !createPassword) return;
    if (createPassword !== createConfirmPassword) return;
    createUser.mutate(
      { email: createEmail.trim(), name: createName.trim(), password: createPassword, role: createRole },
      {
        onSuccess: () => {
          setCreateEmail('');
          setCreateName('');
          setCreatePassword('');
          setCreateConfirmPassword('');
          setCreateRole('USER');
          setShowCreate(false);
        },
      },
    );
  };

  const handleEditSave = () => {
    if (!editUser) return;
    const promises: Promise<any>[] = [];
    if (editName !== editUser.name || editRole !== editUser.role) {
      promises.push(
        updateUser.mutateAsync({ userId: editUser.id, name: editName, role: editRole }),
      );
    }
    if (editPassword && editPassword === editConfirmPassword) {
      promises.push(
        setUserPassword.mutateAsync({ userId: editUser.id, password: editPassword }),
      );
    }
    Promise.all(promises)
      .then(() => {
        setEditUser(null);
        setEditPassword('');
        setEditConfirmPassword('');
      })
      .catch(() => {
        // Individual mutation onError handlers show toasts; keep dialog open for retry
      });
  };

  const openEditDialog = (user: AdminUser) => {
    setEditUser(user);
    setEditName(user.name);
    setEditRole(user.role);
    setEditPassword('');
    setEditConfirmPassword('');
    setGroupSearch('');
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">{t('admin.users.title')}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowInvite(!showInvite)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            {t('admin.users.inviteUser')}
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('admin.users.createUser')}
          </Button>
        </div>
      </div>

      {/* Invite Dialog */}
      {showInvite && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('admin.users.inviteNewUser')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                placeholder={t('admin.users.emailPlaceholder')}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Input
                placeholder={t('admin.users.nameOptional')}
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">{t('roles.admin')}</SelectItem>
                  <SelectItem value="USER">{t('roles.user')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleInvite} disabled={inviteUser.isPending}>
                {inviteUser.isPending ? t('common.sending') : t('admin.users.sendInvitation')}
              </Button>
              <Button variant="outline" onClick={() => setShowInvite(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.users.createUser')}</DialogTitle>
            <DialogDescription>{t('admin.users.createUserDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{t('common.email')}</Label>
              <Input
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder={t('admin.users.emailPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('common.name')}</Label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={t('admin.users.namePlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('common.password')}</Label>
                <Input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.users.confirmPassword')}</Label>
                <Input
                  type="password"
                  value={createConfirmPassword}
                  onChange={(e) => setCreateConfirmPassword(e.target.value)}
                />
              </div>
            </div>
            {createPassword && createConfirmPassword && createPassword !== createConfirmPassword && (
              <p className="text-sm text-red-500">{t('validation.passwordsDoNotMatch')}</p>
            )}
            <div className="space-y-2">
              <Label>{t('common.role')}</Label>
              <Select value={createRole} onValueChange={setCreateRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">{t('roles.admin')}</SelectItem>
                  <SelectItem value="USER">{t('roles.user')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
              <Button
                onClick={handleCreate}
                disabled={
                  !createEmail.trim() ||
                  !createName.trim() ||
                  createPassword.length < 6 ||
                  createPassword !== createConfirmPassword ||
                  createUser.isPending
                }
              >
                {createUser.isPending ? t('common.creating') : t('admin.users.createUser')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('admin.users.editUser')}</DialogTitle>
            <DialogDescription>{editUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{t('common.name')}</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('common.role')}</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">{t('roles.admin')}</SelectItem>
                  <SelectItem value="USER">{t('roles.user')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Groups section */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {t('admin.users.groups')}
              </p>
              {/* Current groups */}
              <div className="flex flex-wrap gap-2 mb-3">
                {userGroups && userGroups.length > 0 ? (
                  userGroups.map((membership) => (
                    <Badge key={membership.id} variant="secondary" className="gap-1 pr-1">
                      {membership.group.name}
                      <button
                        onClick={() => editUser && removeUserFromGroup.mutate({ groupId: membership.group.id, userId: editUser.id })}
                        disabled={removeUserFromGroup.isPending}
                        className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors disabled:opacity-50"
                        aria-label={`${t('admin.users.removeFromGroup')}: ${membership.group.name}`}
                        title={t('admin.users.removeFromGroup')}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">{t('admin.users.noGroups')}</span>
                )}
              </div>
              {/* Add to group */}
              <div className="relative">
                <Input
                  placeholder={t('admin.users.searchGroupsToAdd')}
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  onBlur={() => setTimeout(() => setGroupSearch(''), 200)}
                  className="h-8 text-sm"
                />
                {groupSearch && searchedGroups && searchedGroups.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md" role="listbox">
                    {searchedGroups
                      .filter((g) => !userGroups?.some((ug) => ug.group.id === g.id))
                      .map((group) => (
                        <button
                          key={group.id}
                          role="option"
                          disabled={addUserToGroup.isPending}
                          onClick={() => {
                            if (editUser) addUserToGroup.mutate({ groupId: group.id, userId: editUser.id });
                            setGroupSearch('');
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors first:rounded-t-md last:rounded-b-md disabled:opacity-50"
                        >
                          <span>{group.name}</span>
                          <span className="text-xs text-muted-foreground">{group._count.members} {t('admin.groups.memberCount')?.toLowerCase()}</span>
                        </button>
                      ))}
                    {searchedGroups.filter((g) => !userGroups?.some((ug) => ug.group.id === g.id)).length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">{t('admin.users.allGroupsAssigned')}</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">{t('admin.users.setPassword')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('admin.users.newPassword')}</Label>
                  <Input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder={t('admin.users.newPasswordPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('admin.users.confirmPassword')}</Label>
                  <Input
                    type="password"
                    value={editConfirmPassword}
                    onChange={(e) => setEditConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              {editPassword && editConfirmPassword && editPassword !== editConfirmPassword && (
                <p className="text-sm text-red-500 mt-2">{t('validation.passwordsDoNotMatch')}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditUser(null)}>{t('common.cancel')}</Button>
              <Button
                onClick={handleEditSave}
                disabled={
                  (editPassword && (editPassword.length < 6 || editPassword !== editConfirmPassword)) ||
                  updateUser.isPending ||
                  setUserPassword.isPending
                }
              >
                {t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('admin.users.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v === 'all' ? '' : v); setPage(0); }}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder={t('admin.users.roleColumn')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.users.allRoles')}</SelectItem>
            <SelectItem value="ADMIN">{t('roles.admin')}</SelectItem>
            <SelectItem value="USER">{t('roles.user')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(0); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t('admin.users.statusColumn')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.users.allStatuses')}</SelectItem>
            <SelectItem value="ACTIVE">{t('common.active')}</SelectItem>
            <SelectItem value="SUSPENDED">{t('common.suspended')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
          <span className="text-sm font-medium">
            {t('admin.users.selected', { count: selectedIds.size })}
          </span>
          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950"
              onClick={handleBulkSuspend}
              disabled={bulkSuspend.isPending}
            >
              <Ban className="h-4 w-4" />
              {t('admin.users.suspendSelected', { count: selectedIds.size })}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={handleBulkDelete}
              disabled={bulkDelete.isPending}
            >
              <Trash2 className="h-4 w-4" />
              {t('admin.users.deleteSelected', { count: selectedIds.size })}
            </Button>
          </div>
        </div>
      )}

      {/* Users Table */}
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
                      <th className="pb-3 pr-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300"
                          checked={allSelectableSelected}
                          onChange={toggleSelectAll}
                          disabled={selectableUsers.length === 0}
                        />
                      </th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.users.nameColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.users.emailColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.users.roleColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.users.statusColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.users.joinedColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.users.lastLoginColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.users.ipColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.users.actionsColumn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users?.map((user: AdminUser) => {
                      const isAdmin = user.role === 'ADMIN';
                      return (
                        <tr key={user.id} className="border-b border-border last:border-0">
                          <td className="py-3 pr-2">
                            {isAdmin ? (
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300"
                                disabled
                                checked={false}
                                title="Admin users cannot be selected for bulk actions"
                              />
                            ) : (
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300"
                                checked={selectedIds.has(user.id)}
                                onChange={() => toggleSelect(user.id)}
                              />
                            )}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                                {user.name?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                              <span className="font-medium">{user.name}</span>
                            </div>
                          </td>
                          <td className="py-3 text-muted-foreground">{user.email}</td>
                          <td className="py-3">
                            <Select
                              value={user.role}
                              onValueChange={(role) =>
                                updateRole.mutate({ userId: user.id, role })
                              }
                            >
                              <SelectTrigger className="w-28 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ADMIN">{t('roles.admin')}</SelectItem>
                                <SelectItem value="USER">{t('roles.user')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-3">
                            <div className="flex flex-col gap-1">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium w-fit ${
                                  user.status === 'SUSPENDED'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                }`}
                              >
                                {user.status === 'SUSPENDED' ? t('common.suspended') : t('common.active')}
                              </span>
                              {!user.emailVerified && (
                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium w-fit bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                  {t('admin.users.emailNotVerified')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString(locale)}
                          </td>
                          <td className="py-3 text-muted-foreground" title={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString(locale) : undefined}>
                            {formatRelativeTime(user.lastLoginAt)}
                          </td>
                          <td className="py-3 text-muted-foreground font-mono text-xs">
                            {user.lastLoginIp || '-'}
                          </td>
                          <td className="py-3">
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title={t('admin.users.editUser')}
                                onClick={() => openEditDialog(user)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {user.status === 'ACTIVE' ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-orange-500 hover:text-orange-600"
                                  title={t('admin.users.suspendUser')}
                                  onClick={() => suspendUser.mutate(user.id)}
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-green-500 hover:text-green-600"
                                  title={t('admin.users.activateUser')}
                                  onClick={() => activateUser.mutate(user.id)}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                title={t('admin.users.deleteUser')}
                                onClick={() => {
                                  if (confirm(t('admin.users.confirmDeleteUser'))) {
                                    deleteUser.mutate(user.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {t('common.showing', { from: page * PAGE_SIZE + 1, to: page * PAGE_SIZE + (users?.length || 0) })}
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
                    disabled={!users || users.length < PAGE_SIZE}
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
