import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface WatchStatus {
  watching: boolean;
  watcherCount: number;
}

function watchKey(slug: string, pageId: string) {
  return ['page-watch', slug, pageId] as const;
}

export function usePageWatchStatus(slug: string, pageId: string, enabled = true) {
  return useQuery<WatchStatus>({
    queryKey: watchKey(slug, pageId),
    queryFn: async () => {
      const { data } = await api.get<WatchStatus>(
        `/spaces/${slug}/pages/${pageId}/watch`,
      );
      return data;
    },
    enabled: enabled && !!slug && !!pageId,
    staleTime: 30_000,
  });
}

export function useWatchPage(slug: string, pageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<WatchStatus>(
        `/spaces/${slug}/pages/${pageId}/watch`,
      );
      return data;
    },
    // Optimistic flip — the toggle should feel instant.
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: watchKey(slug, pageId) });
      const prev = qc.getQueryData<WatchStatus>(watchKey(slug, pageId));
      if (prev) {
        qc.setQueryData<WatchStatus>(watchKey(slug, pageId), {
          watching: true,
          watcherCount: prev.watching ? prev.watcherCount : prev.watcherCount + 1,
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(watchKey(slug, pageId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: watchKey(slug, pageId) });
    },
  });
}

export function useUnwatchPage(slug: string, pageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete<WatchStatus>(
        `/spaces/${slug}/pages/${pageId}/watch`,
      );
      return data;
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: watchKey(slug, pageId) });
      const prev = qc.getQueryData<WatchStatus>(watchKey(slug, pageId));
      if (prev) {
        qc.setQueryData<WatchStatus>(watchKey(slug, pageId), {
          watching: false,
          watcherCount: prev.watching ? Math.max(0, prev.watcherCount - 1) : prev.watcherCount,
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(watchKey(slug, pageId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: watchKey(slug, pageId) });
    },
  });
}
