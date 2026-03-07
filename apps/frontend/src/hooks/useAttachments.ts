import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Attachment } from '@/types';

export function useAttachments(pageId: string) {
  return useQuery<Attachment[]>({
    queryKey: ['attachments', pageId],
    queryFn: async () => {
      const { data } = await api.get(`/pages/${pageId}/attachments`);
      return data;
    },
    enabled: !!pageId,
  });
}

export function useUploadAttachment(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post(`/pages/${pageId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', pageId] });
    },
  });
}

export function useDeleteAttachment(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (attachmentId: string) => {
      await api.delete(`/attachments/${attachmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', pageId] });
    },
  });
}

export async function getDownloadUrl(attachmentId: string): Promise<string> {
  const { data } = await api.get(`/attachments/${attachmentId}/download`);
  return data.url || data;
}
