'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Search, LayoutDashboard, Plus, Bell, User, Shield, FileText } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { t } = useTranslation();

  const navigate = useCallback(
    (path: string) => {
      router.push(path);
      onOpenChange(false);
      setSearch('');
    },
    [router, onOpenChange]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/4 w-full max-w-lg -translate-x-1/2">
        <Command
          className="rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
          shouldFilter={true}
        >
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder={t('commandPalette.placeholder')}
              className="flex h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              {t('commandPalette.noResults')}
            </Command.Empty>

            <Command.Group heading={t('commandPalette.navigation')} className="text-xs font-medium text-muted-foreground px-2 py-1.5">
              <Command.Item
                onSelect={() => navigate('/spaces')}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent aria-selected:bg-accent"
              >
                <LayoutDashboard className="h-4 w-4" />
                {t('commandPalette.spaces')}
              </Command.Item>
              <Command.Item
                onSelect={() => navigate('/spaces/new')}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent aria-selected:bg-accent"
              >
                <Plus className="h-4 w-4" />
                {t('commandPalette.newSpace')}
              </Command.Item>
              <Command.Item
                onSelect={() => navigate('/search')}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent aria-selected:bg-accent"
              >
                <FileText className="h-4 w-4" />
                {t('search.title')}
              </Command.Item>
              <Command.Item
                onSelect={() => navigate('/notifications')}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent aria-selected:bg-accent"
              >
                <Bell className="h-4 w-4" />
                {t('notifications.title')}
              </Command.Item>
              <Command.Item
                onSelect={() => navigate('/profile')}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent aria-selected:bg-accent"
              >
                <User className="h-4 w-4" />
                {t('profile.title')}
              </Command.Item>
              <Command.Item
                onSelect={() => navigate('/admin')}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent aria-selected:bg-accent"
              >
                <Shield className="h-4 w-4" />
                {t('commandPalette.admin')}
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

// Hook for Cmd+K
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { open, setOpen };
}
