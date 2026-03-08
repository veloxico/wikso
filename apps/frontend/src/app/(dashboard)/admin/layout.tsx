'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Settings,
  Shield,
  Users,
  FolderOpen,
  ScrollText,
  Key,
  Mail,
  Webhook,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const adminNav = [
  { href: '/admin/general', label: 'General', icon: Settings },
  { href: '/admin/security', label: 'Security & Access', icon: Shield },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/spaces', label: 'Spaces', icon: FolderOpen },
  { href: '/admin/audit-log', label: 'Audit Log', icon: ScrollText },
  { href: '/admin/auth', label: 'Auth Providers', icon: Key },
  { href: '/admin/email', label: 'Email', icon: Mail },
  { href: '/admin/webhooks', label: 'Webhooks', icon: Webhook },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full">
      <nav className="w-56 shrink-0 border-r border-border p-4 space-y-1 overflow-y-auto">
        <h2 className="mb-4 px-3 text-lg font-semibold">Administration</h2>
        {adminNav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1 overflow-y-auto p-8">{children}</div>
    </div>
  );
}
