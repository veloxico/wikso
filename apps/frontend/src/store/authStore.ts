import { create } from 'zustand';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
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
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    document.cookie = `accessToken=${accessToken}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  },
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    document.cookie = 'accessToken=; path=/; max-age=0';
    set({ user: null, isAuthenticated: false });
  },
  hydrate: () => {
    if (get().hydrated) return;
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('accessToken');

    if (stored && token) {
      try {
        const user = JSON.parse(stored);
        set({ user, isAuthenticated: true, hydrated: true });
        return;
      } catch { /* fall through */ }
    }

    if (token) {
      // Token exists but no cached user — fetch from API
      set({ isAuthenticated: true, hydrated: true });
      api.get('/users/me')
        .then(({ data }) => {
          set({ user: data });
          localStorage.setItem('user', JSON.stringify(data));
        })
        .catch(() => {
          // Token invalid
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          document.cookie = 'accessToken=; path=/; max-age=0';
          set({ user: null, isAuthenticated: false });
        });
    } else {
      set({ hydrated: true });
    }
  },
}));
