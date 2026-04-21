import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

// ─── Interfaces ──────────────────────────────────────────

export interface Template {
  id: string;
  title: string;
  description: string | null;
  contentJson: object;
  category: string;
  icon: string | null;
  isDefault: boolean;
  spaceId: string | null;
  creatorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateDto {
  title: string;
  description?: string;
  contentJson: object;
  category: string;
  icon?: string;
  isDefault?: boolean;
  spaceId?: string;
}

export interface UpdateTemplateDto {
  title?: string;
  description?: string;
  contentJson?: object;
  category?: string;
  icon?: string;
  isDefault?: boolean;
}

// ─── Hooks ───────────────────────────────────────────────

export function useTemplates() {
  return useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await api.get('/templates');
      return data;
    },
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (dto: CreateTemplateDto) => {
      const { data } = await api.post('/templates', dto);
      return data as Template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success(t('toasts.templateCreated'));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || t('toasts.templateCreateFailed'));
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({ id, ...dto }: UpdateTemplateDto & { id: string }) => {
      const { data } = await api.patch(`/templates/${id}`, dto);
      return data as Template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success(t('toasts.templateUpdated'));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || t('toasts.templateUpdateFailed'));
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/templates/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success(t('toasts.templateDeleted'));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || t('toasts.templateDeleteFailed'));
    },
  });
}
