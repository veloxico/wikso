'use client';

import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <FileQuestion className="mx-auto mb-6 h-16 w-16 text-muted-foreground/40" />
        <h1 className="mb-2 text-6xl font-bold text-foreground">{t('errors.notFound.code')}</h1>
        <h2 className="mb-4 text-xl font-medium text-muted-foreground">{t('errors.notFound.title')}</h2>
        <p className="mb-8 max-w-md text-muted-foreground">
          {t('errors.notFound.description')}
        </p>
        <Link
          href="/spaces"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t('errors.notFound.backToHome')}
        </Link>
      </div>
    </div>
  );
}
