import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface RecentPageItem {
  id: string;
  pageId: string;
  visitedAt: string;
  page: {
    id: string;
    title: string;
    slug: string;
    status: string;
    space: {
      id: string;
      slug: string;
      name: string;
    };
  };
}

export function useRecentPages() {
  return useQuery<RecentPageItem[]>({
    queryKey: ['recentPages'],
    queryFn: async () => {
      const { data } = await api.get('/recent-pages');
      return Array.isArray(data) ? data : data?.data ?? [];
    },
  });
}

export function useRecordPageVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pageId: string) => {
      const { data } = await api.post(`/recent-pages/${pageId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recentPages'] });
    },
  });
}
