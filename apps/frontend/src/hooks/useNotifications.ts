import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { Notification } from '@/types';

export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get('/notifications');
      // Backend returns paginated { data: Notification[], total, skip, take }
      return Array.isArray(data) ? data : data?.data ?? [];
    },
  });
}

/**
 * Lightweight unread counter — polled every 45 s.
 * Only enabled when the user is authenticated to avoid
 * 401 spam on the public/login pages.
 */
export function useUnreadNotificationCount() {
  const user = useAuthStore((s) => s.user);
  return useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/unread-count');
      return data ?? { count: 0 };
    },
    enabled: !!user,
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.patch('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
}
