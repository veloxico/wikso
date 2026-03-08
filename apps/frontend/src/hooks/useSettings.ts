import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export interface SystemSettings {
  id: string;
  siteName: string;
  siteDescription: string;
  registrationEnabled: boolean;
  allowedEmailDomains: string[];
  emailVerificationRequired: boolean;
  passwordMinLength: number;
  sessionTimeoutMinutes: number;
  maxAttachmentSizeMb: number;
  updatedAt: string;
}

export interface PublicSettings {
  siteName: string;
  registrationEnabled: boolean;
}

export function useSystemSettings() {
  return useQuery<SystemSettings>({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const { data } = await api.get('/admin/settings');
      return data;
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Partial<SystemSettings>) => {
      const { data } = await api.patch('/admin/settings', dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      queryClient.invalidateQueries({ queryKey: ['public', 'settings'] });
      toast.success('Settings saved');
    },
    onError: () => {
      toast.error('Failed to save settings');
    },
  });
}

export function usePublicSettings() {
  return useQuery<PublicSettings>({
    queryKey: ['public', 'settings'],
    queryFn: async () => {
      const { data } = await api.get('/auth/settings/public');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
