import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type AnalyticsPeriod = '7d' | '30d' | '90d';

export interface PageAnalytics {
  period: AnalyticsPeriod;
  since: string;
  totalViews: number;
  viewsInPeriod: number;
  uniqueViewers: number;
  dailyCounts: { date: string; views: number; uniqueUsers: number }[];
}

function analyticsKey(slug: string, pageId: string, period: AnalyticsPeriod) {
  return ['page-analytics', slug, pageId, period] as const;
}

export function usePageAnalytics(
  slug: string,
  pageId: string,
  period: AnalyticsPeriod,
  enabled = true,
) {
  return useQuery<PageAnalytics>({
    queryKey: analyticsKey(slug, pageId, period),
    queryFn: async () => {
      const { data } = await api.get(
        `/spaces/${slug}/pages/${pageId}/analytics`,
        { params: { period } },
      );
      return data;
    },
    enabled: enabled && !!slug && !!pageId,
    // View counts shift slowly; 60s of cache is plenty for the "open the
    // dialog, glance, close" pattern this drives.
    staleTime: 60_000,
  });
}
