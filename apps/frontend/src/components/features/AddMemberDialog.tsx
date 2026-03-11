'use client';

import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { UserPlus, Users, UsersRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';

interface AddMemberDialogProps {
  slug: string;
}

export function AddMemberDialog({ slug }: AddMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'user' | 'group'>('user');
  const [userSearch, setUserSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [role, setRole] = useState('EDITOR');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { data: userResults } = useQuery({
    queryKey: ['spaces', slug, 'members', 'search', userSearch],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${slug}/members/search`, { params: { q: userSearch } });
      return Array.isArray(data) ? data : [];
    },
    enabled: tab === 'user' && userSearch.length >= 1,
  });

  const { data: groupResults } = useQuery({
    queryKey: ['groups', 'search', groupSearch],
    queryFn: async () => {
      const { data } = await api.get('/groups/search', { params: { q: groupSearch } });
      return Array.isArray(data) ? data : [];
    },
    enabled: tab === 'group' && groupSearch.length >= 1,
  });

  const addMember = useMutation({
    mutationFn: async () => {
      const payload: any = { role };
      if (tab === 'user') payload.userId = selectedUserId;
      else payload.groupId = selectedGroupId;
      await api.post(`/spaces/${slug}/members`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', slug, 'members'] });
      setOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || t('addMember.failedToAdd'));
    },
  });

  const resetForm = () => {
    setUserSearch('');
    setGroupSearch('');
    setSelectedUserId('');
    setSelectedGroupId('');
    setSelectedLabel('');
    setRole('EDITOR');
    setError(null);
    setTab('user');
  };

  const isValid = tab === 'user' ? !!selectedUserId : !!selectedGroupId;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" />
          {t('addMember.title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addMember.title')}</DialogTitle>
          <DialogDescription>{t('addMember.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Tab toggle */}
          <div className="flex rounded-md border border-border">
            <button
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-l-md transition-colors ${
                tab === 'user' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
              onClick={() => { setTab('user'); setSelectedGroupId(''); setSelectedLabel(''); }}
            >
              <Users className="h-4 w-4" />
              {t('addMember.userTab')}
            </button>
            <button
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-r-md transition-colors ${
                tab === 'group' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
              onClick={() => { setTab('group'); setSelectedUserId(''); setSelectedLabel(''); }}
            >
              <UsersRound className="h-4 w-4" />
              {t('addMember.groupTab')}
            </button>
          </div>

          {/* User search */}
          {tab === 'user' && (
            <div className="space-y-2">
              <Label>{t('addMember.searchUsers')}</Label>
              {selectedUserId ? (
                <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                  <span className="flex-1 text-sm">{selectedLabel}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => { setSelectedUserId(''); setSelectedLabel(''); }}
                  >
                    &times;
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder={t('addMember.searchUsersPlaceholder')}
                  />
                  {userResults && userResults.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-background">
                      {userResults.map((u: any) => (
                        <div
                          key={u.id}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                          onClick={() => {
                            setSelectedUserId(u.id);
                            setSelectedLabel(`${u.name} (${u.email})`);
                            setUserSearch('');
                          }}
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                            {u.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <span className="font-medium">{u.name}</span>
                            <span className="ml-2 text-muted-foreground">{u.email}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Group search */}
          {tab === 'group' && (
            <div className="space-y-2">
              <Label>{t('addMember.searchGroups')}</Label>
              {selectedGroupId ? (
                <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                  <span className="flex-1 text-sm">{selectedLabel}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => { setSelectedGroupId(''); setSelectedLabel(''); }}
                  >
                    &times;
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    placeholder={t('addMember.searchGroupsPlaceholder')}
                  />
                  {groupResults && groupResults.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-background">
                      {groupResults.map((g: any) => (
                        <div
                          key={g.id}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                          onClick={() => {
                            setSelectedGroupId(g.id);
                            setSelectedLabel(`${g.name} (${g._count?.members || 0} members)`);
                            setGroupSearch('');
                          }}
                        >
                          <UsersRound className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="font-medium">{g.name}</span>
                            {g.description && (
                              <span className="ml-2 text-muted-foreground">{g.description}</span>
                            )}
                          </div>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {g._count?.members || 0} {t('admin.groups.memberCount').toLowerCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Role */}
          <div className="space-y-2">
            <Label>{t('addMember.roleLabel')}</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">{t('roles.admin')}</SelectItem>
                <SelectItem value="EDITOR">{t('roles.editor')}</SelectItem>
                <SelectItem value="VIEWER">{t('roles.viewer')}</SelectItem>
                <SelectItem value="GUEST">{t('common.guest')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={() => addMember.mutate()}
              disabled={!isValid || addMember.isPending}
            >
              {addMember.isPending ? t('addMember.adding') : t('addMember.button')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
