'use client';

import Link from 'next/link';
import { User, Settings, LogOut, Moon, Sun, Monitor, Globe } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useLanguageStore, SUPPORTED_LOCALES, type Locale } from '@/store/languageStore';

interface UserMenuProps {
  /** Avatar size class, e.g. "h-8 w-8" or "h-7 w-7" */
  avatarSize?: string;
  /** Whether to show the user name text next to avatar */
  showName?: boolean;
}

export function UserMenu({ avatarSize = 'h-8 w-8', showName = true }: UserMenuProps) {
  const { user, logout } = useAuthStore();
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useLanguageStore();

  const avatarUrl = (user as any)?.avatarUrl;
  const initial = user?.name?.charAt(0)?.toUpperCase() || '?';

  const themeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const ThemeIcon = themeIcon;

  const nextTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const themeLabel = theme === 'dark'
    ? t('profile.themeDark')
    : theme === 'light'
      ? t('profile.themeLight')
      : t('profile.themeSystem');

  const nextLocale = () => {
    const locales = SUPPORTED_LOCALES.map((l) => l.value);
    const idx = locales.indexOf(locale);
    const next = locales[(idx + 1) % locales.length];
    setLocale(next as Locale);
  };

  const currentLocaleName = SUPPORTED_LOCALES.find((l) => l.value === locale)?.nativeLabel || locale;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 min-w-0 rounded-md p-1 hover:bg-sidebar-accent/50 transition-colors outline-none">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={user?.name || ''}
              className={`${avatarSize} shrink-0 rounded-full object-cover`}
            />
          ) : (
            <div className={`flex ${avatarSize} shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium`}>
              {initial}
            </div>
          )}
          {showName && (
            <span className="truncate text-sm">{user?.name || t('common.guest')}</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64">
        {/* User info header */}
        <div className="flex items-center gap-3 px-2 py-2.5">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={user?.name || ''}
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || t('common.guest')}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Profile settings */}
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <User className="h-4 w-4" />
            {t('sidebar.profile')}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Quick theme toggle */}
        <DropdownMenuItem onClick={nextTheme}>
          <ThemeIcon className="h-4 w-4" />
          {t('profile.theme')}: {themeLabel}
        </DropdownMenuItem>

        {/* Quick language toggle */}
        <DropdownMenuItem onClick={nextLocale}>
          <Globe className="h-4 w-4" />
          {t('profile.language')}: {currentLocaleName}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Logout */}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => {
            logout();
            window.location.href = '/login';
          }}
        >
          <LogOut className="h-4 w-4" />
          {t('sidebar.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
