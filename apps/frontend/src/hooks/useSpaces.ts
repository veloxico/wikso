import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { Space } from '@/types';

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
  return useMutation({
    mutationFn: async (input: CreateSpaceInput) => {
      const { data } = await api.post('/spaces', input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      toast.success('Space created');
    },
    onError: () => {
      toast.error('Failed to create space');
    },
  });
}

export function useUpdateSpace(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name?: string; description?: string }) => {
      const { data } = await api.patch(`/spaces/${slug}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', slug] });
      toast.success('Space updated');
    },
    onError: () => {
      toast.error('Failed to update space');
    },
  });
}

export function useDeleteSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (slug: string) => {
      const { data } = await api.delete(`/spaces/${slug}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      toast.success('Space deleted');
    },
    onError: () => {
      toast.error('Failed to delete space');
    },
  });
}

export function useAddMember(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; role: string }) => {
      const { data } = await api.post(`/spaces/${slug}/members`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', slug, 'members'] });
      toast.success('Member added');
    },
    onError: () => {
      toast.error('Failed to add member');
    },
  });
}

export function useRemoveMember(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.delete(`/spaces/${slug}/members/${userId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', slug, 'members'] });
      toast.success('Member removed');
    },
    onError: () => {
      toast.error('Failed to remove member');
    },
  });
}

export function useSpaceMembers(slug: string) {
  return useQuery({
    queryKey: ['spaces', slug, 'members'],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${slug}/members`);
      return data;
    },
    enabled: !!slug,
  });
}
