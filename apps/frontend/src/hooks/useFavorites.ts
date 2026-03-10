import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface FavoriteItem {
  id: string;
  pageId: string;
  createdAt: string;
  page: {
    id: string;
    title: string;
    slug: string;
    space: {
      id: string;
      slug: string;
      name: string;
    };
  };
}

export function useFavorites() {
  return useQuery<FavoriteItem[]>({
    queryKey: ['favorites'],
    queryFn: async () => {
      const { data } = await api.get('/favorites');
      return Array.isArray(data) ? data : data?.data ?? [];
    },
  });
}

export function useCheckFavorite(pageId: string) {
  return useQuery<{ isFavorite: boolean }>({
    queryKey: ['favorites', 'check', pageId],
    queryFn: async () => {
      const { data } = await api.get(`/favorites/check/${pageId}`);
      return data;
    },
    enabled: !!pageId,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pageId: string) => {
      const { data } = await api.post(`/favorites/${pageId}`);
      return data as { isFavorite: boolean };
    },
    onSuccess: (_data, pageId) => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['favorites', 'check', pageId] });
    },
  });
}

export function useRemoveFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pageId: string) => {
      const { data } = await api.delete(`/favorites/${pageId}`);
      return data;
    },
    onSuccess: (_data, pageId) => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['favorites', 'check', pageId] });
    },
  });
}
