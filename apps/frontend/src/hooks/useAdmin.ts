import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { User } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';

// ─── Interfaces ──────────────────────────────────────────

export interface AdminStats {
  totalUsers: number;
  totalSpaces: number;
  totalPages: number;
  totalComments: number;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  meta: Record<string, unknown>;
  createdAt: string;
  user?: { id: string; name: string; email: string };
}

export interface AuthProviderInfo {
  enabled: boolean;
  label: string;
  clientIdConfigured?: boolean;
  callbackUrl?: string;
  entryPointConfigured?: boolean;
  issuer?: string;
  certConfigured?: boolean;
}

export interface AuthProvidersStatus {
  local: AuthProviderInfo;
  google: AuthProviderInfo;
  github: AuthProviderInfo;
  saml: AuthProviderInfo;
}

export interface AdminSpace {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: string;
  ownerId: string;
  createdAt: string;
  owner: { id: string; name: string; email: string };
  _count: { pages: number; permissions: number };
}

export interface AdminWebhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  userId: string;
  createdAt: string;
}

export interface EmailStatus {
  configured: boolean;
  provider: string;
  fromAddress: string;
}

export interface ProviderFieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'select';
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
}

export interface ProviderInfo {
  type: string;
  name: string;
  description: string;
  docsUrl: string;
  fields: ProviderFieldDefinition[];
}

export interface EmailConfig {
  provider: string;
  config: Record<string, any>;
  fromAddress: string;
  fromName: string;
}

// ─── Stats ───────────────────────────────────────────────

export function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const { data } = await api.get('/admin/stats');
      return {
        totalUsers: data.usersCount ?? data.totalUsers ?? 0,
        totalSpaces: data.spacesCount ?? data.totalSpaces ?? 0,
        totalPages: data.pagesCount ?? data.totalPages ?? 0,
        totalComments: data.commentsCount ?? data.totalComments ?? 0,
      };
    },
  });
}

// ─── Users ───────────────────────────────────────────────

export function useAdminUsers(
  skip = 0,
  take = 20,
  filters?: { search?: string; role?: string; status?: string },
) {
  return useQuery<User[]>({
    queryKey: ['admin', 'users', skip, take, filters],
    queryFn: async () => {
      const { data } = await api.get('/admin/users', {
        params: { skip, take, ...filters },
      });
      return Array.isArray(data) ? data : data.users ?? [];
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { data } = await api.patch(`/admin/users/${userId}/role`, { role });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success(t('toasts.userRoleUpdated'));
    },
    onError: () => toast.error(t('toasts.userRoleUpdateFailed')),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.delete(`/admin/users/${userId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success(t('toasts.userDeleted'));
    },
    onError: () => toast.error(t('toasts.userDeleteFailed')),
  });
}

export function useSuspendUser() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.patch(`/admin/users/${userId}/suspend`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success(t('toasts.userSuspended'));
    },
    onError: () => toast.error(t('toasts.userSuspendFailed')),
  });
}

export function useActivateUser() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.patch(`/admin/users/${userId}/activate`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success(t('toasts.userActivated'));
    },
    onError: () => toast.error(t('toasts.userActivateFailed')),
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (dto: { email: string; role?: string; name?: string }) => {
      const { data } = await api.post('/admin/users/invite', dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success(t('toasts.invitationSent'));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || t('toasts.inviteFailed'));
    },
  });
}

export function useBulkInvite() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (dto: { emails: string[]; role?: string }) => {
      const { data } = await api.post('/admin/users/invite/bulk', dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success(t('toasts.bulkInvitesSent'));
    },
    onError: () => toast.error(t('toasts.bulkInviteFailed')),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (dto: { email: string; name: string; password: string; role?: string }) => {
      const { data } = await api.post('/admin/users', dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success(t('toasts.userCreated'));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || t('toasts.userCreateFailed'));
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({ userId, ...dto }: { userId: string; name?: string; role?: string }) => {
      const { data } = await api.patch(`/admin/users/${userId}`, dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success(t('toasts.userUpdated'));
    },
    onError: () => toast.error(t('toasts.userUpdateFailed')),
  });
}

export function useSetUserPassword() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const { data } = await api.patch(`/admin/users/${userId}/password`, { password });
      return data;
    },
    onSuccess: () => toast.success(t('toasts.passwordSet')),
    onError: () => toast.error(t('toasts.passwordSetFailed')),
  });
}

// ─── Audit Log ───────────────────────────────────────────

export function useAuditLog(
  skip = 0,
  take = 20,
  filters?: { action?: string; userId?: string; from?: string; to?: string; search?: string },
) {
  return useQuery<AuditLogEntry[]>({
    queryKey: ['admin', 'audit-log', skip, take, filters],
    queryFn: async () => {
      const { data } = await api.get('/admin/audit-log', {
        params: { skip, take, ...filters },
      });
      return Array.isArray(data) ? data : data.logs ?? [];
    },
  });
}

// ─── Auth Providers ──────────────────────────────────────

export function useAuthProviders() {
  return useQuery<AuthProvidersStatus>({
    queryKey: ['admin', 'auth-providers'],
    queryFn: async () => {
      const { data } = await api.get('/admin/auth-providers');
      return data;
    },
  });
}

// ─── Spaces ──────────────────────────────────────────────

export function useAdminSpaces(skip = 0, take = 20) {
  return useQuery<AdminSpace[]>({
    queryKey: ['admin', 'spaces', skip, take],
    queryFn: async () => {
      const { data } = await api.get('/admin/spaces', { params: { skip, take } });
      return Array.isArray(data) ? data : data.spaces ?? [];
    },
  });
}

export function useDeleteAdminSpace() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (spaceId: string) => {
      const { data } = await api.delete(`/admin/spaces/${spaceId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'spaces'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success(t('toasts.spaceDeleted'));
    },
    onError: () => toast.error(t('toasts.spaceDeleteFailed')),
  });
}

// ─── Email ───────────────────────────────────────────────

export function useEmailStatus() {
  return useQuery<EmailStatus>({
    queryKey: ['admin', 'email-status'],
    queryFn: async () => {
      const { data } = await api.get('/admin/email/status');
      return data;
    },
  });
}

export function useEmailProviders() {
  return useQuery<ProviderInfo[]>({
    queryKey: ['admin', 'email-providers'],
    queryFn: async () => {
      const { data } = await api.get('/admin/email/providers');
      return data;
    },
  });
}

export function useEmailConfig() {
  return useQuery<EmailConfig>({
    queryKey: ['admin', 'email-config'],
    queryFn: async () => {
      const { data } = await api.get('/admin/email/config');
      return data;
    },
  });
}

export function useSaveEmailConfig() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (dto: { provider: string; config: Record<string, any>; fromAddress?: string; fromName?: string }) => {
      const { data } = await api.put('/admin/email/config', dto);
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'email-status'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'email-config'] });
      toast.success(data.message || t('toasts.emailConfigSaved'));
    },
    onError: () => toast.error(t('toasts.emailConfigSaveFailed')),
  });
}

export function useDeleteEmailConfig() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete('/admin/email/config');
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'email-status'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'email-config'] });
      toast.success(data.message || t('toasts.emailConfigCleared'));
    },
    onError: () => toast.error(t('toasts.emailConfigDeleteFailed')),
  });
}

export function useTestEmail() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/admin/email/test');
      return data;
    },
    onSuccess: (data: any) => {
      if (data.success) toast.success(data.message);
      else toast.error(data.message);
    },
    onError: () => toast.error(t('toasts.testEmailFailed')),
  });
}

// ─── Webhooks ────────────────────────────────────────────

export function useAdminWebhooks(skip = 0, take = 20) {
  return useQuery<AdminWebhook[]>({
    queryKey: ['admin', 'webhooks', skip, take],
    queryFn: async () => {
      const { data } = await api.get('/admin/webhooks', { params: { skip, take } });
      return Array.isArray(data) ? data : data.webhooks ?? [];
    },
  });
}

export function useToggleWebhook() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { data } = await api.patch(`/admin/webhooks/${id}`, { active });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'webhooks'] });
      toast.success(t('toasts.webhookUpdated'));
    },
    onError: () => toast.error(t('toasts.webhookUpdateFailed')),
  });
}

// ─── Trash ──────────────────────────────────────────────

export interface AdminTrashedPage {
  id: string;
  title: string;
  deletedAt: string;
  deletedBy: string | null;
  space: { id: string; name: string; slug: string } | null;
  author: { id: string; name: string } | null;
}

export function useAdminTrash(skip = 0, take = 20, search?: string) {
  return useQuery<{ pages: AdminTrashedPage[]; total: number }>({
    queryKey: ['admin', 'trash', skip, take, search],
    queryFn: async () => {
      const { data } = await api.get('/admin/trash', {
        params: { skip, take, ...(search ? { search } : {}) },
      });
      return data;
    },
  });
}

export function useAdminRestorePage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (pageId: string) => {
      const { data } = await api.post(`/admin/trash/${pageId}/restore`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'trash'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success(t('admin.trash.restored'));
    },
    onError: () => toast.error(t('toasts.pageRestoreFailed')),
  });
}

export function useAdminPermanentDelete() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (pageId: string) => {
      const { data } = await api.delete(`/admin/trash/${pageId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'trash'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success(t('admin.trash.deleted'));
    },
    onError: () => toast.error(t('toasts.pageDeleteFailed')),
  });
}
