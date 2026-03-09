'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Settings,
  Shield,
  Users,
  FolderOpen,
  Trash2,
  ScrollText,
  Key,
  Mail,
  Webhook,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { UserMenu } from '@/components/features/UserMenu';

export function AdminSidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();

  const adminNav = [
    { href: '/admin/general', labelKey: 'admin.nav.general', icon: Settings },
    { href: '/admin/security', labelKey: 'admin.nav.securityAccess', icon: Shield },
    { href: '/admin/users', labelKey: 'admin.nav.users', icon: Users },
    { href: '/admin/spaces', labelKey: 'admin.nav.spaces', icon: FolderOpen },
    { href: '/admin/trash', labelKey: 'admin.nav.trash', icon: Trash2 },
    { href: '/admin/audit-log', labelKey: 'admin.nav.auditLog', icon: ScrollText },
    { href: '/admin/auth', labelKey: 'admin.nav.authProviders', icon: Key },
    { href: '/admin/email', labelKey: 'admin.nav.email', icon: Mail },
    { href: '/admin/webhooks', labelKey: 'admin.nav.webhooks', icon: Webhook },
  ];

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-4">
        <Link href="/spaces" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
            D
          </div>
          <span className="text-lg font-semibold">Dokka</span>
        </Link>
      </div>

      {/* Back to spaces */}
      <div className="px-3 py-2 border-b border-border">
        <Link
          href="/spaces"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('admin.backToSpaces') || 'Back to Spaces'}
        </Link>
      </div>

      {/* Admin title */}
      <div className="px-6 pt-4 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          {t('admin.title')}
        </h2>
      </div>

      {/* Admin navigation */}
      <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
        {adminNav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      {/* User menu */}
      <div className="border-t border-border p-3">
        <UserMenu avatarSize="h-8 w-8" showName />
      </div>
    </aside>
  );
}
