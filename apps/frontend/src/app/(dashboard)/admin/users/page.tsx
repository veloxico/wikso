'use client';

import { useState } from 'react';
import {
  Users,
  Search,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Ban,
  CheckCircle2,
} from 'lucide-react';
import {
  useAdminUsers,
  useUpdateUserRole,
  useDeleteUser,
  useSuspendUser,
  useActivateUser,
  useInviteUser,
} from '@/hooks/useAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/useTranslation';

const PAGE_SIZE = 10;

export default function AdminUsersPage() {
  const { t, locale } = useTranslation();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('VIEWER');
  const [inviteName, setInviteName] = useState('');

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

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">{t('admin.users.title')}</h1>
        </div>
        <Button onClick={() => setShowInvite(!showInvite)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          {t('admin.users.inviteUser')}
        </Button>
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
                  <SelectItem value="EDITOR">{t('roles.editor')}</SelectItem>
                  <SelectItem value="VIEWER">{t('roles.viewer')}</SelectItem>
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
            <SelectItem value="EDITOR">{t('roles.editor')}</SelectItem>
            <SelectItem value="VIEWER">{t('roles.viewer')}</SelectItem>
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
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.users.nameColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.users.emailColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.users.roleColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.users.statusColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.users.joinedColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.users.actionsColumn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users?.map((user: any) => (
                      <tr key={user.id} className="border-b border-border last:border-0">
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
                              <SelectItem value="EDITOR">{t('roles.editor')}</SelectItem>
                              <SelectItem value="VIEWER">{t('roles.viewer')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              user.status === 'SUSPENDED'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            }`}
                          >
                            {user.status === 'SUSPENDED' ? t('common.suspended') : t('common.active')}
                          </span>
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString(locale)}
                        </td>
                        <td className="py-3">
                          <div className="flex gap-1">
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
                    ))}
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
