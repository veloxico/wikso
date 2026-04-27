'use client';

/**
 * CommandPalette — Cmd/Ctrl+K launcher.
 *
 * Uses the warm-paper `wp-cmdk*` styles from globals.css. Each row is
 * a wp-cmdk-row with a left-side icon "tile" (wp-cmdk-row-icon) that
 * lights up in `--accent-soft / --accent-ink` when keyboard-selected
 * — same affordance as the slash menu, so the user only learns the
 * pattern once.
 *
 * Footer shows the relevant keyboard hints (↵ enter, ↑↓ navigate, esc).
 * cmdk handles all of the focus/selection plumbing — we just need to
 * wire `data-selected` (which it sets on the active row) into the
 * styles.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Search, LayoutDashboard, Plus, Bell, User, Shield, FileText } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PaletteItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub?: string;
  path: string;
  shortcut?: string;
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
    [router, onOpenChange],
  );

  if (!open) return null;

  const navItems: PaletteItem[] = [
    { icon: LayoutDashboard, label: t('commandPalette.spaces'), path: '/spaces' },
    { icon: Plus, label: t('commandPalette.newSpace'), path: '/spaces/new' },
    { icon: FileText, label: t('search.title'), path: '/search' },
    { icon: Bell, label: t('notifications.title'), path: '/notifications' },
    { icon: User, label: t('profile.title'), path: '/profile' },
    { icon: Shield, label: t('commandPalette.admin'), path: '/admin' },
  ];

  return (
    <div className="wp-cmdk-overlay" onClick={() => onOpenChange(false)}>
      <div onClick={(e) => e.stopPropagation()}>
        <Command className="wp-cmdk" shouldFilter={true}>
          <div className="wp-cmdk-search">
            <Search className="h-4 w-4 shrink-0 text-[color:var(--ink-3)]" strokeWidth={1.75} />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder={t('commandPalette.placeholder')}
              autoFocus
            />
          </div>
          <Command.List className="flex-1 overflow-y-auto p-2">
            <Command.Empty className="py-10 text-center text-sm text-[color:var(--ink-3)]">
              {t('commandPalette.noResults')}
            </Command.Empty>

            <Command.Group heading={t('commandPalette.navigation')}>
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.path}
                    value={item.label}
                    onSelect={() => navigate(item.path)}
                    className="wp-cmdk-row"
                  >
                    <span className="wp-cmdk-row-icon">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <div className="wp-cmdk-row-title truncate">{item.label}</div>
                      {item.sub && <div className="wp-cmdk-row-sub truncate">{item.sub}</div>}
                    </span>
                    {item.shortcut && <span className="wp-cmdk-row-shortcut">{item.shortcut}</span>}
                  </Command.Item>
                );
              })}
            </Command.Group>
          </Command.List>
          <div className="wp-cmdk-foot">
            <span><kbd>↵</kbd> open</span>
            <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
            <span><kbd>esc</kbd> close</span>
          </div>
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
