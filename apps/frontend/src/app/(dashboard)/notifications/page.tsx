'use client';

import { useRouter } from 'next/navigation';
import {
  Bell,
  CheckCheck,
  MessageSquare,
  FileText,
  Users,
  UserPlus,
  UserMinus,
  Reply,
} from 'lucide-react';
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '@/hooks/useNotifications';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types';

function getNotificationConfig(t: (key: string) => string): Record<
  string,
  { icon: React.ElementType; label: string; color: string }
> {
  return {
    'comment.created': {
      icon: MessageSquare,
      label: t('notifications.types.commentCreated'),
      color: 'text-blue-500',
    },
    'comment.reply': {
      icon: Reply,
      label: t('notifications.types.commentReply'),
      color: 'text-cyan-500',
    },
    'page.created': {
      icon: FileText,
      label: t('notifications.types.pageCreated'),
      color: 'text-green-500',
    },
    'page.updated': {
      icon: FileText,
      label: t('notifications.types.pageUpdated'),
      color: 'text-yellow-500',
    },
    'space.member_added': {
      icon: UserPlus,
      label: t('notifications.types.memberAdded'),
      color: 'text-purple-500',
    },
    'space.member_removed': {
      icon: UserMinus,
      label: t('notifications.types.memberRemoved'),
      color: 'text-red-500',
    },
    mention: {
      icon: Users,
      label: t('notifications.types.mentioned'),
      color: 'text-indigo-500',
    },
  };
}

function getNotificationMessage(notif: Notification, t: (key: string, params?: Record<string, any>) => string): string {
  const payload = notif.payload as Record<string, any>;

  switch (notif.type) {
    case 'comment.created':
      return t('notifications.messages.commentCreated', { author: payload.authorName || 'Someone', page: payload.pageTitle || 'a page' });
    case 'comment.reply':
      return t('notifications.messages.commentReply', { author: payload.authorName || 'Someone', page: payload.pageTitle || 'a page' });
    case 'page.created':
      return t('notifications.messages.pageCreated', { page: payload.pageTitle || 'Untitled', space: payload.spaceName || 'a space' });
    case 'page.updated':
      return t('notifications.messages.pageUpdated', { page: payload.pageTitle || 'Untitled', space: payload.spaceName || 'a space' });
    case 'space.member_added':
      return t('notifications.messages.memberAdded', { space: payload.spaceName || 'a space', role: payload.role || 'member' });
    case 'space.member_removed':
      return t('notifications.messages.memberRemoved', { space: payload.spaceName || 'a space' });
    case 'mention':
      return t('notifications.messages.mentioned', { page: payload.pageTitle || 'a page' });
    default:
      return notif.type.replace(/\./g, ': ');
  }
}

function getNotificationLink(notif: Notification): string | null {
  const payload = notif.payload as Record<string, any>;

  if (payload.spaceSlug && payload.pageId) {
    return `/spaces/${payload.spaceSlug}/pages/${payload.pageId}`;
  }
  if (payload.spaceSlug) {
    return `/spaces/${payload.spaceSlug}`;
  }
  return null;
}

function formatRelativeTime(dateStr: string, t: (key: string, params?: Record<string, any>) => string, locale: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('notifications.justNow');
  if (mins < 60) return t('notifications.minutesAgo', { mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('notifications.hoursAgo', { hrs });
  const days = Math.floor(hrs / 24);
  if (days < 7) return t('notifications.daysAgo', { days });
  return new Date(dateStr).toLocaleDateString(locale);
}

// Group notifications by date
function groupByDate(notifications: Notification[], t: (key: string) => string, locale: string): Map<string, Notification[]> {
  const groups = new Map<string, Notification[]>();
  for (const n of notifications) {
    const date = new Date(n.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let key: string;
    if (date.toDateString() === today.toDateString()) {
      key = t('notifications.today');
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = t('notifications.yesterday');
    } else {
      key = date.toLocaleDateString(locale, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    }

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(n);
  }
  return groups;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { data: notifications, isLoading } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const { t, locale } = useTranslation();

  const notificationConfig = getNotificationConfig(t);
  const unreadCount = notifications?.filter((n) => !n.read).length || 0;
  const grouped = notifications ? groupByDate(notifications, t, locale) : new Map();

  const handleClick = (notif: Notification) => {
    if (!notif.read) markAsRead.mutate(notif.id);

    const link = getNotificationLink(notif);
    if (link) router.push(link);
  };

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('notifications.title')}</h1>
          {unreadCount > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {t('notifications.unread', { count: unreadCount })}
            </p>
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
            {t('notifications.markAllRead')}
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
          <p className="text-lg font-medium">{t('notifications.allCaughtUp')}</p>
          <p className="text-muted-foreground">{t('notifications.noNotifications')}</p>
        </div>
      )}

      {notifications && notifications.length > 0 && (
        <div className="space-y-6">
          {[...grouped.entries()].map(([dateLabel, items]: [string, Notification[]]) => (
            <div key={dateLabel}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {dateLabel}
              </h3>
              <div className="space-y-2">
                {items.map((notif) => {
                  const config = notificationConfig[notif.type] || {
                    icon: Bell,
                    label: notif.type,
                    color: 'text-muted-foreground',
                  };
                  const Icon = config.icon;
                  const link = getNotificationLink(notif);

                  return (
                    <div
                      key={notif.id}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border border-border p-4 transition-colors',
                        !notif.read && 'bg-accent/30 border-accent',
                        link && 'cursor-pointer hover:bg-accent/50',
                      )}
                      onClick={() => handleClick(notif)}
                      role="button"
                      tabIndex={0}
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted',
                        )}
                      >
                        <Icon className={cn('h-4 w-4', config.color)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            {config.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(notif.createdAt, t, locale)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm">{getNotificationMessage(notif, t)}</p>
                        {link && (
                          <p className="mt-1 text-xs text-primary hover:underline">
                            {t('notifications.view')}
                          </p>
                        )}
                      </div>
                      {!notif.read && (
                        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
