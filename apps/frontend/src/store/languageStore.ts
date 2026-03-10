import { create } from 'zustand';
import { api } from '@/lib/api';

export type Locale = 'en' | 'ru' | 'uk' | 'be' | 'pl' | 'es' | 'esAR' | 'pt' | 'ptBR' | 'zh';

export const SUPPORTED_LOCALES: { value: Locale; label: string; nativeLabel: string }[] = [
  { value: 'en', label: 'English', nativeLabel: 'English' },
  { value: 'ru', label: 'Russian', nativeLabel: 'Русский' },
  { value: 'uk', label: 'Ukrainian', nativeLabel: 'Українська' },
  { value: 'be', label: 'Belarusian', nativeLabel: 'Беларуская' },
  { value: 'pl', label: 'Polish', nativeLabel: 'Polski' },
  { value: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { value: 'esAR', label: 'Spanish (Argentina)', nativeLabel: 'Español (Argentina)' },
  { value: 'pt', label: 'Portuguese', nativeLabel: 'Português' },
  { value: 'ptBR', label: 'Portuguese (Brazil)', nativeLabel: 'Português (Brasil)' },
  { value: 'zh', label: 'Chinese', nativeLabel: '中文' },
];

const VALID_LOCALES = new Set<string>(SUPPORTED_LOCALES.map((l) => l.value));

/** Convert internal locale code to BCP 47 lang tag for HTML */
export function toBcp47(locale: string): string {
  return locale.replace(/([a-z])([A-Z])/, '$1-$2');
}

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
      localStorage.setItem('wikso-locale', locale);
      document.documentElement.lang = toBcp47(locale);
      api.patch('/users/me', { locale }).catch(() => {});
    }
  },
  hydrate: () => {
    if (get().hydrated) return;
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('wikso-locale') as Locale | null;
    if (stored && VALID_LOCALES.has(stored)) {
      set({ locale: stored, hydrated: true });
      document.documentElement.lang = toBcp47(stored);
    } else {
      set({ hydrated: true });
    }
  },
}));
