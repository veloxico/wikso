import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { Page } from '@/types';

export function usePages(slug: string) {
  return useQuery<Page[]>({
    queryKey: ['pages', slug],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${slug}/pages`);
      return data;
    },
    enabled: !!slug,
  });
}

export function usePage(slug: string, pageId: string) {
  return useQuery<Page>({
    queryKey: ['pages', slug, pageId],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${slug}/pages/${pageId}`);
      return data;
    },
    enabled: !!slug && !!pageId,
  });
}

interface CreatePageInput {
  title: string;
  parentId?: string;
  contentJson?: Record<string, unknown>;
  status?: string;
}

export function useCreatePage(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePageInput) => {
      const { data } = await api.post(`/spaces/${slug}/pages`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages', slug] });
      toast.success('Page created');
    },
    onError: () => {
      toast.error('Failed to create page');
    },
  });
}

interface UpdatePageInput {
  title?: string;
  contentJson?: Record<string, unknown>;
  status?: string;
}

export function useUpdatePage(slug: string, pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdatePageInput) => {
      const { data } = await api.patch(`/spaces/${slug}/pages/${pageId}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages', slug] });
      queryClient.invalidateQueries({ queryKey: ['pages', slug, pageId] });
    },
  });
}

export function useDeletePage(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pageId: string) => {
      const { data } = await api.delete(`/spaces/${slug}/pages/${pageId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages', slug] });
      toast.success('Page deleted');
    },
    onError: () => {
      toast.error('Failed to delete page');
    },
  });
}
