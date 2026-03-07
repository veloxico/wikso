import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { User } from '@/types';

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
  entity: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  user?: { id: string; name: string; email: string };
}

export function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const { data } = await api.get('/admin/stats');
      return data;
    },
  });
}

export function useAdminUsers(skip = 0, take = 20) {
  return useQuery<User[]>({
    queryKey: ['admin', 'users', skip, take],
    queryFn: async () => {
      const { data } = await api.get('/admin/users', { params: { skip, take } });
      return data;
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { data } = await api.patch(`/admin/users/${userId}`, { role });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('User role updated');
    },
    onError: () => {
      toast.error('Failed to update user role');
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.delete(`/admin/users/${userId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success('User deleted');
    },
    onError: () => {
      toast.error('Failed to delete user');
    },
  });
}

export function useAuditLog(skip = 0, take = 20) {
  return useQuery<AuditLogEntry[]>({
    queryKey: ['admin', 'audit-log', skip, take],
    queryFn: async () => {
      const { data } = await api.get('/admin/audit-log', { params: { skip, take } });
      return data;
    },
  });
}
