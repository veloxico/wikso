'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Search, Bell, Settings, LogOut, Plus, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/spaces', label: 'Spaces', icon: LayoutDashboard },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/profile', label: 'Profile', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
          D
        </div>
        <span className="text-lg font-semibold">Dokka</span>
      </div>

      {/* New space button */}
      <div className="px-3 py-3">
        <Link href="/spaces/new">
          <Button variant="outline" className="w-full justify-start gap-2" size="sm">
            <Plus className="h-4 w-4" />
            New Space
          </Button>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Admin link */}
      {user?.role === 'ADMIN' && (
        <div className="px-3 pb-1">
          <Link
            href="/admin"
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith('/admin')
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
            )}
          >
            <Shield className="h-4 w-4" />
            Admin
          </Link>
        </div>
      )}

      {/* User */}
      <div className="border-t border-border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium">
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <span className="truncate text-sm">{user?.name || 'Guest'}</span>
          </div>
          <button
            onClick={() => {
              logout();
              window.location.href = '/login';
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
