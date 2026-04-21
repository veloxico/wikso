import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface PageShare {
  id: string;
  pageId: string;
  token: string;
  hasPassword: boolean;
  allowComments: boolean;
  viewCount: number;
  lastViewedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string; avatarUrl: string | null } | null;
}

export interface CreateShareInput {
  expiresAt?: string | null;
  password?: string | null;
  allowComments?: boolean;
}

export interface UpdateShareInput {
  expiresAt?: string | null;
  password?: string | null;
  allowComments?: boolean;
}

function sharesKey(slug: string, pageId: string) {
  return ['shares', slug, pageId] as const;
}

export function usePageShares(slug: string, pageId: string, enabled = true) {
  return useQuery<PageShare[]>({
    queryKey: sharesKey(slug, pageId),
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${slug}/pages/${pageId}/shares`);
      return data;
    },
    enabled: enabled && !!slug && !!pageId,
  });
}

export function useCreateShare(slug: string, pageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateShareInput) => {
      const { data } = await api.post<PageShare>(`/spaces/${slug}/pages/${pageId}/shares`, input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sharesKey(slug, pageId) });
    },
  });
}

export function useUpdateShare(slug: string, pageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ shareId, input }: { shareId: string; input: UpdateShareInput }) => {
      const { data } = await api.patch<PageShare>(
        `/spaces/${slug}/pages/${pageId}/shares/${shareId}`,
        input,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sharesKey(slug, pageId) });
    },
  });
}

export function useRevokeShare(slug: string, pageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shareId: string) => {
      const { data } = await api.delete(`/spaces/${slug}/pages/${pageId}/shares/${shareId}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sharesKey(slug, pageId) });
    },
  });
}

/** Build the public share URL for a token. Falls back to window.location.origin at runtime. */
export function buildShareUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/s/${token}`;
}
