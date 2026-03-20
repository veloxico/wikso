import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

export interface ImportProgress {
  jobId: string;
  state: string;
  phase: 'uploading' | 'extracting' | 'parsing' | 'spaces' | 'pages' | 'attachments' | 'fixing-refs' | 'comments' | 'tags' | 'done' | 'error';
  percent: number;
  counts: {
    spaces: number;
    pages: number;
    attachments: number;
    comments: number;
    tags: number;
  };
  errors: string[];
  message?: string;
}

export function useStartImport() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await api.post('/admin/import/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 600_000, // 10 minutes for upload
      });
      return data as { jobId: string; message: string };
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || t('admin.import.uploadFailed'));
    },
  });
}

export function useImportStatus(jobId: string | null, enabled = true) {
  return useQuery<ImportProgress>({
    queryKey: ['admin', 'import-status', jobId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/import/status/${jobId}`);
      return data;
    },
    enabled: !!jobId && enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      if (data.phase === 'done' || data.phase === 'error') return false;
      return 2000;
    },
    refetchIntervalInBackground: false,
  });
}
