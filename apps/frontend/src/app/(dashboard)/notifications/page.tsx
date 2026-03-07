'use client';

import { Bell, CheckCheck, MessageSquare, FileText, Users } from 'lucide-react';
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const notificationIcon: Record<string, React.ElementType> = {
  'comment.created': MessageSquare,
  'page.updated': FileText,
  'mention': Users,
};

export default function NotificationsPage() {
  const { data: notifications, isLoading } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-border p-4">
              <div className="h-5 w-48 rounded bg-muted" />
              <div className="mt-2 h-4 w-32 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {notifications && notifications.length === 0 && (
        <div className="py-16 text-center">
          <Bell className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-medium">All caught up!</p>
          <p className="text-muted-foreground">No notifications yet.</p>
        </div>
      )}

      {notifications && notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const Icon = notificationIcon[notif.type] || Bell;
            return (
              <div
                key={notif.id}
                className={cn(
                  'flex items-start gap-3 rounded-lg border border-border p-4 transition-colors',
                  !notif.read && 'bg-accent/30 border-accent'
                )}
                onClick={() => {
                  if (!notif.read) markAsRead.mutate(notif.id);
                }}
                role="button"
                tabIndex={0}
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{notif.type.replace('.', ': ')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(notif.createdAt).toLocaleString()}
                  </p>
                </div>
                {!notif.read && (
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
