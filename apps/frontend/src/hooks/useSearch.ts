import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface SearchResult {
  id: string;
  title: string;
  slug: string;
  spaceId: string;
  spaceName?: string;
  spaceSlug?: string;
  excerpt?: string;
  authorId?: string;
  updatedAt?: string;
}

export interface SpaceResult {
  id: string;
  name: string;
  slug: string;
  type: string;
}

interface GlobalSearchResponse {
  pages: SearchResult[];
  spaces: SpaceResult[];
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
      return data.hits ?? data;
    },
    enabled: !!params.q && params.q.length >= 2,
  });
}

export function useGlobalSearch(q: string) {
  return useQuery<GlobalSearchResponse>({
    queryKey: ['search', 'global', q],
    queryFn: async () => {
      const { data } = await api.get('/search/global', { params: { q } });
      return data;
    },
    enabled: q.length >= 2,
  });
}
