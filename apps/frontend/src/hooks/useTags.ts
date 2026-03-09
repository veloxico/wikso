import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

interface Tag {
  id: string;
  name: string;
  spaceId: string;
  _count?: { pages: number };
}

export function useTags(slug: string) {
  return useQuery<Tag[]>({
    queryKey: ['tags', slug],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${slug}/tags`);
      return data;
    },
    enabled: !!slug,
  });
}

export function useCreateTag(slug: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post(`/spaces/${slug}/tags`, { name });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', slug] });
      toast.success(t('tags.tagCreated'));
    },
  });
}

export function useDeleteTag(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tagId: string) => {
      const { data } = await api.delete(`/spaces/${slug}/tags/${tagId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', slug] });
    },
  });
}

export function useAddTagToPage(slug: string, pageId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (tagId: string) => {
      const { data } = await api.post(`/spaces/${slug}/tags/${pageId}/tag/${tagId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages', slug, pageId] });
      queryClient.invalidateQueries({ queryKey: ['tags', slug] });
      toast.success(t('tags.tagAdded'));
    },
  });
}

export function useRemoveTagFromPage(slug: string, pageId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (tagId: string) => {
      const { data } = await api.delete(`/spaces/${slug}/tags/${pageId}/tag/${tagId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages', slug, pageId] });
      queryClient.invalidateQueries({ queryKey: ['tags', slug] });
      toast.success(t('tags.tagRemoved'));
    },
  });
}
