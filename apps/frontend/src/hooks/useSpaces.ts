import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { Space } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';

export function useSpaces() {
  return useQuery<Space[]>({
    queryKey: ['spaces'],
    queryFn: async () => {
      const { data } = await api.get('/spaces');
      return data;
    },
  });
}

export function useSpace(slug: string) {
  return useQuery<Space>({
    queryKey: ['spaces', slug],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${slug}`);
      return data;
    },
    enabled: !!slug,
  });
}

interface CreateSpaceInput {
  name: string;
  slug: string;
  description?: string;
  type?: string;
}

export function useCreateSpace() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (input: CreateSpaceInput) => {
      const { data } = await api.post('/spaces', input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      toast.success(t('toasts.spaceCreated'));
    },
    onError: () => {
      toast.error(t('toasts.spaceCreateFailed'));
    },
  });
}

export function useUpdateSpace(slug: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (input: { name?: string; description?: string }) => {
      const { data } = await api.patch(`/spaces/${slug}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', slug] });
      toast.success(t('toasts.spaceUpdated'));
    },
    onError: () => {
      toast.error(t('toasts.spaceUpdateFailed'));
    },
  });
}

export function useDeleteSpace() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (slug: string) => {
      const { data } = await api.delete(`/spaces/${slug}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      toast.success(t('toasts.spaceDeleted'));
    },
    onError: () => {
      toast.error(t('toasts.spaceDeleteFailed'));
    },
  });
}

export function useAddMember(slug: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (input: { userId: string; role: string }) => {
      const { data } = await api.post(`/spaces/${slug}/members`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', slug, 'members'] });
      toast.success(t('toasts.memberAdded'));
    },
    onError: () => {
      toast.error(t('toasts.memberAddFailed'));
    },
  });
}

export function useRemoveMember(slug: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.delete(`/spaces/${slug}/members/${userId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', slug, 'members'] });
      toast.success(t('toasts.memberRemoved'));
    },
    onError: () => {
      toast.error(t('toasts.memberRemoveFailed'));
    },
  });
}

export function useSpaceMembers(slug: string) {
  return useQuery({
    queryKey: ['spaces', slug, 'members'],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${slug}/members`);
      return Array.isArray(data) ? data : data?.data ?? [];
    },
    enabled: !!slug,
  });
}
