import { create } from 'zustand';
import { api } from '@/lib/api';
import { useLanguageStore, SUPPORTED_LOCALES, toBcp47, type Locale } from '@/store/languageStore';

const VALID_LOCALE_SET = new Set<string>(SUPPORTED_LOCALES.map((l) => l.value));

function syncLocaleFromServer(locale?: string | null) {
  if (locale && VALID_LOCALE_SET.has(locale)) {
    const current = useLanguageStore.getState().locale;
    if (current !== locale) {
      // Update store + localStorage + HTML lang, skip api.patch (already on server)
      useLanguageStore.setState({ locale: locale as Locale });
      if (typeof window !== 'undefined') {
        localStorage.setItem('wikso-locale', locale);
        document.documentElement.lang = toBcp47(locale);
      }
    }
  }
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
  locale?: string;
  timezone?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  hydrated: false,
  setUser: (user) => {
    set({ user, isAuthenticated: !!user });
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      } else {
        localStorage.removeItem('user');
      }
    }
  },
  setTokens: (accessToken, refreshToken) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    document.cookie = `accessToken=${accessToken}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      document.cookie = 'accessToken=; path=/; max-age=0';
    }
    set({ user: null, isAuthenticated: false });
  },
  hydrate: () => {
    if (get().hydrated) return;
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('accessToken');

    const revalidate = () => {
      api.get('/users/me')
        .then(({ data }) => {
          set({ user: data, isAuthenticated: true });
          localStorage.setItem('user', JSON.stringify(data));
          syncLocaleFromServer(data?.locale);
        })
        .catch(() => {
          // Token invalid
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          document.cookie = 'accessToken=; path=/; max-age=0';
          set({ user: null, isAuthenticated: false });
        });
    };

    if (stored && token) {
      try {
        const user = JSON.parse(stored);
        set({ user, isAuthenticated: true, hydrated: true });
        // Background revalidation: show cached user instantly, then sync with server
        revalidate();
        return;
      } catch { /* fall through */ }
    }

    if (token) {
      // Token exists but no cached user — fetch from API
      set({ hydrated: true });
      revalidate();
    } else {
      set({ hydrated: true });
    }
  },
}));
