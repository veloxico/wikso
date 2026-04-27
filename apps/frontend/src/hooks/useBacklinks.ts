import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Backlink {
  id: string;
  title: string;
  slug: string;
  updatedAt: string;
  space: { slug: string; name: string };
  author: { id: string; name: string; avatarUrl: string | null } | null;
  linkedAt: string;
}

function backlinksKey(slug: string, pageId: string) {
  return ['backlinks', slug, pageId] as const;
}

export function useBacklinks(slug: string, pageId: string, enabled = true) {
  return useQuery<Backlink[]>({
    queryKey: backlinksKey(slug, pageId),
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${slug}/pages/${pageId}/backlinks`);
      return data;
    },
    enabled: enabled && !!slug && !!pageId,
    // Backlinks rarely change between two clicks on the same page; let
    // React Query keep the panel snappy without re-fetching every focus.
    staleTime: 30_000,
  });
}
