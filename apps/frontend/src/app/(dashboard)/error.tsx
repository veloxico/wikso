'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8">
      <div className="max-w-md rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-destructive" />
        <h2 className="mb-2 text-lg font-semibold">{t('common.somethingWentWrong')}</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {error.message || t('common.unexpectedError')}
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => router.push('/spaces')}>
            <Home className="mr-2 h-4 w-4" />
            {t('errors.dashboard.goToSpaces')}
          </Button>
          <Button onClick={reset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('common.tryAgain')}
          </Button>
        </div>
      </div>
    </div>
  );
}
