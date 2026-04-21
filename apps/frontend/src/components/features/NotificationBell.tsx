'use client';

import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';

interface NotificationBellProps {
  /** Tailwind size for the underlying icon (default: h-4 w-4). */
  iconClassName?: string;
  /** Anchor the badge for the icon-only sidebar variant. */
  variant?: 'inline' | 'corner';
}

/**
 * Bell icon with an unread-count badge.
 *
 * The badge:
 *  - Hidden when count === 0 or query is loading.
 *  - Shows a red dot for 1–9, "9+" for 10+.
 *  - Sits in the top-right corner with a thin sidebar-tinted ring
 *    so it reads on both light and dark themes without halo'ing.
 */
export function NotificationBell({
  iconClassName = 'h-4 w-4',
  variant = 'inline',
}: NotificationBellProps) {
  const { data } = useUnreadNotificationCount();
  const count = data?.count ?? 0;
  const hasUnread = count > 0;
  const label = count > 9 ? '9+' : String(count);

  return (
    <span className="relative inline-flex items-center justify-center">
      <Bell
        className={cn(
          iconClassName,
          'transition-transform',
          hasUnread && 'animate-[bell-tilt_2.4s_ease-in-out_infinite]',
        )}
      />
      {hasUnread && (
        <span
          aria-label={`${count} unread notifications`}
          className={cn(
            'absolute flex items-center justify-center rounded-full',
            'bg-red-500 text-white font-semibold',
            'ring-2 ring-sidebar',
            // size + position
            count > 9
              ? 'h-4 min-w-[1.1rem] px-1 text-[9px] leading-none'
              : 'h-3.5 w-3.5 text-[9px] leading-none',
            variant === 'corner'
              ? '-top-1 -right-1'
              : '-top-1.5 -right-1.5',
          )}
        >
          {label}
        </span>
      )}
      <style jsx>{`
        @keyframes bell-tilt {
          0%, 92%, 100% { transform: rotate(0deg); }
          94% { transform: rotate(-12deg); }
          96% { transform: rotate(10deg); }
          98% { transform: rotate(-6deg); }
        }
      `}</style>
    </span>
  );
}
