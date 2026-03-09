'use client';

import { Globe } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguageStore, SUPPORTED_LOCALES, type Locale } from '@/store/languageStore';

interface LanguageSwitcherProps {
  compact?: boolean;
}

export function LanguageSwitcher({ compact }: LanguageSwitcherProps) {
  const { locale, setLocale } = useLanguageStore();

  return (
    <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
      <SelectTrigger className={compact ? 'w-auto gap-1.5 h-8 px-2 text-xs' : 'w-[140px]'}>
        <Globe className="h-3.5 w-3.5 shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LOCALES.map((loc) => (
          <SelectItem key={loc.value} value={loc.value}>
            {loc.nativeLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
