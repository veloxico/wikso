'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Comment } from '@/types';

export function useComments(pageId: string) {
  return useQuery<Comment[]>({
    queryKey: ['comments', pageId],
    queryFn: async () => {
      const { data } = await api.get(`/pages/${pageId}/comments`);
      // Backend returns paginated { data: Comment[], total, skip, take }
      return Array.isArray(data) ? data : data?.data ?? [];
    },
    enabled: !!pageId,
  });
}

export function useCreateComment(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { content: string; parentId?: string }) => {
      const { data } = await api.post(`/pages/${pageId}/comments`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', pageId] });
    },
  });
}

export function useUpdateComment(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      const { data } = await api.patch(`/comments/${commentId}`, { content });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', pageId] });
    },
  });
}

export function useDeleteComment(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      const { data } = await api.delete(`/comments/${commentId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', pageId] });
    },
  });
}

export function useToggleReaction(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, emoji }: { commentId: string; emoji: string }) => {
      const { data } = await api.post(`/comments/${commentId}/reactions`, { emoji });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', pageId] });
    },
  });
}

export function useSearchUsers(query: string) {
  return useQuery<{ id: string; name: string; email: string; avatarUrl?: string }[]>({
    queryKey: ['users', 'search', query],
    queryFn: async () => {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
      return data;
    },
    enabled: query.length >= 1,
  });
}
