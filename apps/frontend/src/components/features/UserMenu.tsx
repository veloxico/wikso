'use client';

import Link from 'next/link';
import { User, Settings, LogOut, Moon, Sun, Monitor, Globe } from 'lucide-react';
import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'framer-motion';
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
import { avatarStyle, initialsFor } from '@/lib/avatarColor';

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
  const initial = initialsFor(user?.name);
  const palette = avatarStyle(user?.name);

  const themeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const ThemeIcon = themeIcon;

  /**
   * Cycle light → dark → system. When the browser supports the View
   * Transitions API and the user hasn't requested reduced motion, we
   * wrap the theme swap in `document.startViewTransition()` and set a
   * CSS custom-property origin so the new theme wipes in as a circular
   * reveal from the menu-item click point. Everything degrades
   * gracefully to a direct setTheme() otherwise.
   */
  const nextTheme = (e: React.MouseEvent<HTMLElement>) => {
    const next: 'light' | 'dark' | 'system' =
      theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';

    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    type DocWithVT = Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    const doc = document as DocWithVT;
    if (prefersReducedMotion || typeof doc.startViewTransition !== 'function') {
      setTheme(next);
      return;
    }

    document.documentElement.style.setProperty('--wipe-x', `${x}px`);
    document.documentElement.style.setProperty('--wipe-y', `${y}px`);
    doc.startViewTransition(() => setTheme(next));
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
            <div
              className={`flex ${avatarSize} shrink-0 items-center justify-center rounded-full text-[11px] font-semibold`}
              style={palette}
            >
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
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
              style={palette}
            >
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

        {/* Quick theme toggle — icon crossfades via Motion while the
            page itself crossfades via the View Transitions API. */}
        <DropdownMenuItem onClick={nextTheme}>
          <span className="relative inline-flex h-4 w-4 items-center justify-center">
            <AnimatePresence initial={false} mode="wait">
              <motion.span
                key={theme ?? 'system'}
                initial={{ rotate: -90, scale: 0, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                exit={{ rotate: 90, scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                className="inline-flex"
                aria-hidden="true"
              >
                <ThemeIcon className="h-4 w-4" />
              </motion.span>
            </AnimatePresence>
          </span>
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
