import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface PopularPage {
  id: string;
  title: string;
  slug: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
}

export function usePopularPages(slug: string, period: string = '7d') {
  return useQuery<PopularPage[]>({
    queryKey: ['analytics', 'popular', slug, period],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${slug}/pages/popular?period=${period}`);
      return data;
    },
    enabled: !!slug,
  });
}
