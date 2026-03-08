'use client';

import { useState } from 'react';
import {
  Shield,
  Users,
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Trash2,
  UserCog,
  ScrollText,
  Key,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  useAdminStats,
  useAdminUsers,
  useUpdateUserRole,
  useDeleteUser,
  useAuditLog,
  useAuthProviders,
  type AuthProviderInfo,
} from '@/hooks/useAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PAGE_SIZE = 10;

export default function AdminPage() {
  const [tab, setTab] = useState<'users' | 'audit' | 'auth'>('users');
  const [usersPage, setUsersPage] = useState(0);
  const [auditPage, setAuditPage] = useState(0);

  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: users, isLoading: usersLoading } = useAdminUsers(
    usersPage * PAGE_SIZE,
    PAGE_SIZE,
  );
  const { data: auditLog, isLoading: auditLoading } = useAuditLog(
    auditPage * PAGE_SIZE,
    PAGE_SIZE,
  );
  const { data: authProviders, isLoading: authLoading } = useAuthProviders();
  const updateRole = useUpdateUserRole();
  const deleteUser = useDeleteUser();

  const statCards = [
    { label: 'Users', value: stats?.totalUsers, icon: Users, color: 'text-blue-500' },
    { label: 'Spaces', value: stats?.totalSpaces, icon: BarChart3, color: 'text-green-500' },
    { label: 'Pages', value: stats?.totalPages, icon: Activity, color: 'text-purple-500' },
    { label: 'Comments', value: stats?.totalComments, icon: Activity, color: 'text-orange-500' },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="h-8 w-16 animate-pulse rounded bg-muted" />
                ) : (
                  <p className="text-2xl font-bold">{stat.value ?? '—'}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tab switcher */}
      <div className="mb-4 flex gap-2">
        <Button
          variant={tab === 'users' ? 'default' : 'outline'}
          size="sm"
          className="gap-2"
          onClick={() => setTab('users')}
        >
          <UserCog className="h-4 w-4" />
          Users
        </Button>
        <Button
          variant={tab === 'audit' ? 'default' : 'outline'}
          size="sm"
          className="gap-2"
          onClick={() => setTab('audit')}
        >
          <ScrollText className="h-4 w-4" />
          Audit Log
        </Button>
        <Button
          variant={tab === 'auth' ? 'default' : 'outline'}
          size="sm"
          className="gap-2"
          onClick={() => setTab('auth')}
        >
          <Key className="h-4 w-4" />
          Auth Providers
        </Button>
      </div>

      {/* Users Table */}
      {tab === 'users' && (
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
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
                        <th className="pb-3 font-medium text-muted-foreground">Name</th>
                        <th className="pb-3 font-medium text-muted-foreground">Email</th>
                        <th className="pb-3 font-medium text-muted-foreground">Role</th>
                        <th className="pb-3 font-medium text-muted-foreground">Joined</th>
                        <th className="pb-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users?.map((user) => (
                        <tr
                          key={user.id}
                          className="border-b border-border last:border-0"
                        >
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
                                <SelectItem value="ADMIN">Admin</SelectItem>
                                <SelectItem value="VIEWER">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm('Delete this user? This action cannot be undone.')) {
                                  deleteUser.mutate(user.id);
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

                {/* Pagination */}
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {usersPage * PAGE_SIZE + 1}–
                    {usersPage * PAGE_SIZE + (users?.length || 0)}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={usersPage === 0}
                      onClick={() => setUsersPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!users || users.length < PAGE_SIZE}
                      onClick={() => setUsersPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Auth Providers */}
      {tab === 'auth' && (
        <Card>
          <CardHeader>
            <CardTitle>Authentication Providers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-6 text-sm text-muted-foreground">
              Provider credentials are configured via environment variables. This panel shows the current configuration status.
            </p>
            {authLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : authProviders ? (
              <div className="space-y-4">
                {(Object.entries(authProviders) as [string, AuthProviderInfo][]).map(
                  ([key, provider]) => (
                    <div
                      key={key}
                      className="flex items-start gap-4 rounded-lg border border-border p-4"
                    >
                      <div className="mt-0.5">
                        {provider.enabled ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{provider.label}</span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              provider.enabled
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                            }`}
                          >
                            {provider.enabled ? 'Enabled' : 'Not Configured'}
                          </span>
                        </div>
                        {provider.callbackUrl && provider.callbackUrl !== 'Not configured' && (
                          <p className="text-xs text-muted-foreground truncate">
                            Callback: <code className="bg-muted px-1 py-0.5 rounded">{provider.callbackUrl}</code>
                          </p>
                        )}
                        {(provider as any).issuer && (provider as any).issuer !== 'Not configured' && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Issuer: <code className="bg-muted px-1 py-0.5 rounded">{(provider as any).issuer}</code>
                          </p>
                        )}
                        {(provider as any).certConfigured !== undefined && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Certificate: {(provider as any).certConfigured ? '✓ Configured' : '✗ Missing'}
                          </p>
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Unable to load provider status.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Audit Log */}
      {tab === 'audit' && (
        <Card>
          <CardHeader>
            <CardTitle>Audit Log</CardTitle>
          </CardHeader>
          <CardContent>
            {auditLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : auditLog && auditLog.length > 0 ? (
              <>
                <div className="space-y-2">
                  {auditLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-medium">
                            {(entry as any).user?.name || entry.userId}
                          </span>{' '}
                          <span className="text-muted-foreground">{entry.action}</span>{' '}
                          <span className="font-medium">{entry.entity}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {auditPage + 1}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={auditPage === 0}
                      onClick={() => setAuditPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!auditLog || auditLog.length < PAGE_SIZE}
                      onClick={() => setAuditPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 text-center">
                <ScrollText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No audit log entries yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
