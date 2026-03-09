import { useCallback } from 'react';
import { useLanguageStore } from '@/store/languageStore';
import translations from '@/i18n';

/* eslint-disable @typescript-eslint/no-explicit-any */

function getNestedValue(obj: any, path: string): string | undefined {
  const result = path.split('.').reduce((acc, part) => acc?.[part], obj);
  return typeof result === 'string' ? result : undefined;
}

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{${key}}`;
  });
}

export function useTranslation() {
  const locale = useLanguageStore((s) => s.locale);
  const dict = translations[locale] || translations.en;

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value = getNestedValue(dict, key);
      if (value === undefined) {
        value = getNestedValue(translations.en, key);
        if (value === undefined) {
          return key;
        }
      }
      return params ? interpolate(value, params) : value;
    },
    [dict],
  );

  return { t, locale };
}
