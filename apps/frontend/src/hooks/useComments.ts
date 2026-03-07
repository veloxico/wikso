'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Comment } from '@/types';

export function useComments(pageId: string) {
  return useQuery<Comment[]>({
    queryKey: ['comments', pageId],
    queryFn: async () => {
      const { data } = await api.get(`/pages/${pageId}/comments`);
      return data;
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
