'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { AuthFooter } from '@/components/features/AuthFooter';
import { useTranslation } from '@/hooks/useTranslation';
import { LanguageSwitcher } from '@/components/features/LanguageSwitcher';
import { WiksoLogo } from '@/components/ui/WiksoLogo';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { t } = useTranslation();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage(t('auth.verifyEmail.invalidToken'));
      return;
    }

    api
      .get(`/auth/verify-email?token=${token}`)
      .then(() => {
        setStatus('success');
      })
      .catch((err) => {
        setStatus('error');
        setErrorMessage(
          err.response?.data?.message || t('auth.verifyEmail.failed'),
        );
      });
  }, [token, t]);

  if (status === 'loading') {
    return (
      <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">
          {t('auth.verifyEmail.verifying')}
        </p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-2xl font-bold">{t('auth.verifyEmail.successTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('auth.verifyEmail.successDescription')}
        </p>
        <Link href="/login" className="mt-6 block">
          <Button className="h-11 w-full">{t('auth.verifyEmail.goToLogin')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
        <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
      </div>
      <h1 className="text-2xl font-bold">{t('auth.verifyEmail.errorTitle')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
      <Link href="/login" className="mt-6 block">
        <Button variant="outline" className="h-11 w-full">{t('auth.verifyEmail.goToLogin')}</Button>
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-background overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>
      <div className="relative z-10 flex w-full max-w-xl flex-col items-center gap-6 px-4">
        <WiksoLogo className="h-16 w-auto text-foreground" />
        <Suspense
          fallback={
            <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <VerifyEmailContent />
        </Suspense>
        <AuthFooter />
        <LanguageSwitcher compact />
      </div>
    </div>
  );
}
