import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
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
    },
  });
}
