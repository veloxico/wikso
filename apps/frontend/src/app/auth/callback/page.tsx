'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { LanguageSwitcher } from '@/components/features/LanguageSwitcher';
import axios from 'axios';

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const setTokens = useAuthStore((s) => s.setTokens);
  const { t } = useTranslation();
  const exchangedRef = useRef(false);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(errorParam);
      return;
    }

    // New flow: exchange one-time code for tokens (tokens are never in URL)
    const code = searchParams.get('code');
    if (code && !exchangedRef.current) {
      exchangedRef.current = true;
      axios
        .post('/api/v1/auth/exchange-code', { code })
        .then(({ data }) => {
          const { accessToken, refreshToken } = data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
          document.cookie = `accessToken=${accessToken}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
          setTokens(accessToken, refreshToken);
          router.replace('/spaces');
        })
        .catch(() => {
          setError(t('auth.callback.failed'));
        });
      return;
    }

    if (!code) {
      setError(t('auth.callback.missingTokens'));
    }
  }, [searchParams, router, setTokens, t]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-bold text-destructive">{t('auth.callback.failed')}</h2>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 text-sm text-primary underline hover:no-underline"
          >
            {t('auth.callback.backToLogin')}
          </button>
          <div className="mt-4">
            <LanguageSwitcher compact />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">{t('auth.callback.completing')}</p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
