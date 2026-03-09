'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, BookOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { AuthFooter } from '@/components/features/AuthFooter';
import { useTranslation } from '@/hooks/useTranslation';
import { LanguageSwitcher } from '@/components/features/LanguageSwitcher';

function createLoginSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().email(t('validation.emailInvalid')),
    password: z.string().min(6, t('validation.passwordMin6')),
  });
}

type LoginValues = z.infer<ReturnType<typeof createLoginSchema>>;

interface AuthProviders {
  github: boolean;
  google: boolean;
  saml: boolean;
}

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setTokens } = useAuthStore();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean>(true);
  const [visible, setVisible] = useState(false);

  const loginSchema = useMemo(() => createLoginSchema(t), [t]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    api.get('/setup/status')
      .then((res) => { if (res.data.setupRequired) router.replace('/setup'); })
      .catch(() => {});

    api.get('/auth/providers')
      .then((res) => setProviders(res.data))
      .catch(() => setProviders({ github: false, google: false, saml: false }));

    api.get('/auth/settings/public')
      .then((res) => setRegistrationEnabled(res.data.registrationEnabled))
      .catch(() => setRegistrationEnabled(true));

    requestAnimationFrame(() => setVisible(true));
  }, [router]);

  const hasOAuth = providers && (providers.github || providers.google || providers.saml);
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  const onSubmit = async (data: LoginValues) => {
    try {
      setError(null);
      const res = await api.post('/auth/login', data);
      const { accessToken, refreshToken, user } = res.data;
      setTokens(accessToken, refreshToken);
      setUser(user);
      router.push('/spaces');
    } catch (err: any) {
      setError(err.response?.data?.message || t('auth.login.failed'));
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-background overflow-hidden">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div
        className="relative z-10 flex w-full max-w-xl flex-col items-center gap-6 px-4 transition-all duration-700"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <span className="text-2xl font-bold tracking-tight">Dokka</span>
        </div>

        {/* Card */}
        <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{t('auth.login.title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('auth.login.description')}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('common.email')}</Label>
              <Input id="email" type="email" placeholder="m@example.com" {...register('email')} className="h-11" />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('common.password')}</Label>
              <Input id="password" type="password" {...register('password')} className="h-11" />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button type="submit" className="h-11 w-full text-base" disabled={isSubmitting}>
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('auth.login.loggingIn')}</>
              ) : (
                t('auth.login.button')
              )}
            </Button>
          </form>

          {hasOAuth && (
            <div className="mt-6">
              <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:-translate-y-1/2 after:border-t after:border-border">
                <span className="relative z-10 bg-card px-3 text-muted-foreground">{t('common.orContinueWith')}</span>
              </div>
              <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: `repeat(${[providers!.github, providers!.google, providers!.saml].filter(Boolean).length}, 1fr)` }}>
                {providers!.github && (
                  <Button variant="outline" className="h-11 w-full" onClick={() => { window.location.href = `${base}/api/v1/auth/github`; }}>
                    GitHub
                  </Button>
                )}
                {providers!.google && (
                  <Button variant="outline" className="h-11 w-full" onClick={() => { window.location.href = `${base}/api/v1/auth/google`; }}>
                    Google
                  </Button>
                )}
                {providers!.saml && (
                  <Button variant="outline" className="h-11 w-full" onClick={() => { window.location.href = `${base}/api/v1/auth/saml`; }}>
                    SSO (SAML)
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <Link href="/forgot-password" className="hover:text-foreground underline underline-offset-4 transition-colors">
              {t('auth.login.forgotPassword')}
            </Link>
            {registrationEnabled && (
              <p>
                {t('auth.login.noAccount')}{' '}
                <Link href="/register" className="font-medium text-foreground underline underline-offset-4">
                  {t('auth.login.signUp')}
                </Link>
              </p>
            )}
          </div>
        </div>

        <AuthFooter />
        <LanguageSwitcher compact />
      </div>
    </div>
  );
}
