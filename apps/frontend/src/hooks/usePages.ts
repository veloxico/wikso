import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { Page } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';

export function usePages(slug: string) {
  return useQuery<Page[]>({
    queryKey: ['pages', slug],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${slug}/pages`);
      return Array.isArray(data) ? data : data?.data ?? [];
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
    // Keep previous page visible while new page loads — prevents flash/flicker on navigation
    placeholderData: keepPreviousData,
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
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (input: CreatePageInput) => {
      const { data } = await api.post(`/spaces/${slug}/pages`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages', slug] });
      toast.success(t('toasts.pageCreated'));
    },
    onError: () => {
      toast.error(t('toasts.pageCreateFailed'));
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
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (pageId: string) => {
      const { data } = await api.delete(`/spaces/${slug}/pages/${pageId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages', slug] });
      queryClient.invalidateQueries({ queryKey: ['trash', slug] });
      toast.success(t('toasts.pageMovedToTrash'));
    },
    onError: () => {
      toast.error(t('toasts.pageDeleteFailed'));
    },
  });
}

export function useDuplicatePage(slug: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (pageId: string) => {
      const { data } = await api.post(`/spaces/${slug}/pages/${pageId}/duplicate`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages', slug] });
      toast.success(t('toasts.pageDuplicated'));
    },
    onError: () => {
      toast.error(t('toasts.pageDuplicateFailed'));
    },
  });
}

export function usePageAncestors(slug: string, pageId: string) {
  return useQuery<{ id: string; title: string; slug: string }[]>({
    queryKey: ['pages', slug, pageId, 'ancestors'],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${slug}/pages/${pageId}/ancestors`);
      return data;
    },
    enabled: !!slug && !!pageId,
  });
}

export function usePopularPages(slug: string, period: string = '7d') {
  return useQuery({
    queryKey: ['pages', slug, 'popular', period],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${slug}/pages/popular?period=${period}`);
      return data;
    },
    enabled: !!slug,
  });
}
