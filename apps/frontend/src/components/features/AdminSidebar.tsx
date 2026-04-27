'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Settings,
  Shield,
  Users,
  UsersRound,
  FolderOpen,
  Trash2,
  ScrollText,
  Key,
  Mail,
  Webhook,
  Activity,
  Upload,
  ArrowLeft,
  Bot,
  LayoutTemplate,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { UserMenu } from '@/components/features/UserMenu';
import { WiksoLogo } from '@/components/ui/WiksoLogo';

export function AdminSidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();

  const adminNav = [
    { href: '/admin/general', labelKey: 'admin.nav.general', icon: Settings },
    { href: '/admin/security', labelKey: 'admin.nav.securityAccess', icon: Shield },
    { href: '/admin/users', labelKey: 'admin.nav.users', icon: Users },
    { href: '/admin/groups', labelKey: 'admin.nav.groups', icon: UsersRound },
    { href: '/admin/spaces', labelKey: 'admin.nav.spaces', icon: FolderOpen },
    { href: '/admin/trash', labelKey: 'admin.nav.trash', icon: Trash2 },
    { href: '/admin/audit-log', labelKey: 'admin.nav.auditLog', icon: ScrollText },
    { href: '/admin/auth', labelKey: 'admin.nav.authProviders', icon: Key },
    { href: '/admin/email', labelKey: 'admin.nav.email', icon: Mail },
    { href: '/admin/webhooks', labelKey: 'admin.nav.webhooks', icon: Webhook },
    { href: '/admin/integrations/slack', labelKey: 'admin.nav.integrationsSlack', icon: MessageCircle },
    { href: '/admin/health', labelKey: 'admin.nav.systemHealth', icon: Activity },
    { href: '/admin/ai', labelKey: 'admin.nav.ai', icon: Bot },
    { href: '/admin/templates', labelKey: 'admin.nav.templates', icon: LayoutTemplate },
    { href: '/admin/import', labelKey: 'admin.nav.import', icon: Upload, badge: 'Beta' },
  ];

  return (
    <aside
      className="flex h-screen w-60 flex-col bg-sidebar text-sidebar-foreground"
      style={{ boxShadow: 'var(--sidebar-shadow)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-3.5">
        <Link href="/spaces" className="flex items-center gap-2.5">
          <WiksoLogo showText={false} className="h-7 w-7" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Wikso</span>
        </Link>
      </div>

      {/* Back to spaces */}
      <div className="px-3 pb-2">
        <Link
          href="/spaces"
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-sidebar-foreground/50 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground transition-all duration-150"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('admin.backToSpaces') || 'Back to Spaces'}
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-3 h-px bg-sidebar-foreground/8" />

      {/* Admin title */}
      <div className="px-4 pt-3 pb-1.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/40">
          {t('admin.title')}
        </h2>
      </div>

      {/* Admin navigation */}
      <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto">
        {adminNav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-[var(--sidebar-item-active-bg)] text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground',
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[var(--sidebar-item-active-border)]" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              {t(item.labelKey)}
              {(item as any).badge && (
                <span className="ml-auto rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                  {(item as any).badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User menu */}
      <div className="px-3 pb-3 pt-1">
        <div className="mx-0 h-px bg-sidebar-foreground/8 mb-2.5" />
        <UserMenu avatarSize="h-7 w-7" showName />
      </div>
    </aside>
  );
}
