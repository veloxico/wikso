import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface SearchResult {
  id: string;
  title: string;
  slug: string;
  spaceId: string;
  spaceName?: string;
  spaceSlug?: string;
  excerpt?: string;
  authorId: string;
  updatedAt: string;
}

interface SearchParams {
  q: string;
  spaceId?: string;
}

export function useSearch(params: SearchParams) {
  return useQuery<SearchResult[]>({
    queryKey: ['search', params],
    queryFn: async () => {
      const { data } = await api.get('/search', { params });
      return data;
    },
    enabled: !!params.q && params.q.length >= 2,
  });
}
