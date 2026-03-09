import { create } from 'zustand';

export type Locale = 'en' | 'ru' | 'es' | 'zh';

export const SUPPORTED_LOCALES: { value: Locale; label: string; nativeLabel: string }[] = [
  { value: 'en', label: 'English', nativeLabel: 'English' },
  { value: 'ru', label: 'Russian', nativeLabel: 'Русский' },
  { value: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { value: 'zh', label: 'Chinese', nativeLabel: '中文' },
];

interface LanguageState {
  locale: Locale;
  hydrated: boolean;
  setLocale: (locale: Locale) => void;
  hydrate: () => void;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  locale: 'en',
  hydrated: false,
  setLocale: (locale) => {
    set({ locale });
    if (typeof window !== 'undefined') {
      localStorage.setItem('dokka-locale', locale);
      document.documentElement.lang = locale;
    }
  },
  hydrate: () => {
    if (get().hydrated) return;
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('dokka-locale') as Locale | null;
    if (stored && ['en', 'ru', 'es', 'zh'].includes(stored)) {
      set({ locale: stored, hydrated: true });
      document.documentElement.lang = stored;
    } else {
      set({ hydrated: true });
    }
  },
}));
