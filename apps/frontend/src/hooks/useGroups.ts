import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

export interface Group {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { members: number };
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  createdAt: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

export interface GroupDetail extends Group {
  members: GroupMember[];
}

export function useGroups(skip = 0, take = 20, search?: string) {
  return useQuery<{ groups: Group[]; total: number }>({
    queryKey: ['groups', skip, take, search],
    queryFn: async () => {
      const { data } = await api.get('/groups', {
        params: { skip, take, ...(search ? { search } : {}) },
      });
      return data;
    },
  });
}

export function useGroup(id: string) {
  return useQuery<GroupDetail>({
    queryKey: ['groups', id],
    queryFn: async () => {
      const { data } = await api.get(`/groups/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (dto: { name: string; description?: string }) => {
      const { data } = await api.post('/groups', dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success(t('toasts.groupCreated'));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || t('toasts.groupCreateFailed'));
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({ id, ...dto }: { id: string; name?: string; description?: string }) => {
      const { data } = await api.patch(`/groups/${id}`, dto);
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', vars.id] });
      toast.success(t('toasts.groupUpdated'));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || t('toasts.groupUpdateFailed'));
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/groups/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success(t('toasts.groupDeleted'));
    },
    onError: () => toast.error(t('toasts.groupDeleteFailed')),
  });
}

export function useGroupMembers(groupId: string) {
  return useQuery<GroupMember[]>({
    queryKey: ['groups', groupId, 'members'],
    queryFn: async () => {
      const { data } = await api.get(`/groups/${groupId}/members`);
      return data;
    },
    enabled: !!groupId,
  });
}

export function useAddGroupMember(groupId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.post(`/groups/${groupId}/members`, { userId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success(t('toasts.groupMemberAdded'));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || t('toasts.groupMemberAddFailed'));
    },
  });
}

export function useRemoveGroupMember(groupId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.delete(`/groups/${groupId}/members/${userId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success(t('toasts.groupMemberRemoved'));
    },
    onError: () => toast.error(t('toasts.groupMemberRemoveFailed')),
  });
}

export function useSearchGroups(query: string) {
  return useQuery<Array<{ id: string; name: string; description: string | null; _count: { members: number } }>>({
    queryKey: ['groups', 'search', query],
    queryFn: async () => {
      const { data } = await api.get('/groups/search', { params: { q: query } });
      return data;
    },
    enabled: query.length >= 1,
  });
}
