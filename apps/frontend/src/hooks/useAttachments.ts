import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { Attachment } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';

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
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post(`/pages/${pageId}/attachments`, formData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', pageId] });
      toast.success(t('toasts.fileUploaded'));
    },
    onError: () => {
      toast.error(t('toasts.fileUploadFailed'));
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
      toast.success('Attachment deleted');
    },
    onError: () => {
      toast.error('Failed to delete attachment');
    },
  });
}

export async function getDownloadUrl(attachmentId: string): Promise<string> {
  const { data } = await api.get(`/attachments/${attachmentId}/download`);
  return data.url || data;
}
