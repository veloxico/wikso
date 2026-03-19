'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ShieldAlert } from 'lucide-react';
import { WiksoLogo } from '@/components/ui/WiksoLogo';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { AuthFooter } from '@/components/features/AuthFooter';
import { useTranslation } from '@/hooks/useTranslation';
import { LanguageSwitcher } from '@/components/features/LanguageSwitcher';

function createRegisterSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, t('validation.nameMin2')),
    email: z.string().email(t('validation.emailInvalid')),
    password: z.string().min(6, t('validation.passwordMin6')),
  });
}

type RegisterValues = z.infer<ReturnType<typeof createRegisterSchema>>;

export default function RegisterPage() {
  const router = useRouter();
  const { setUser, setTokens } = useAuthStore();
  const { t, locale } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);
  const [visible, setVisible] = useState(false);

  const registerSchema = useMemo(() => createRegisterSchema(t), [t]);

  useEffect(() => {
    api.get('/auth/settings/public')
      .then((res) => setRegistrationEnabled(res.data.registrationEnabled))
      .catch(() => setRegistrationEnabled(true));

    requestAnimationFrame(() => setVisible(true));
  }, []);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
  });

  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  const onSubmit = async (data: RegisterValues) => {
    try {
      setError(null);
      const res = await api.post('/auth/register', data);

      // If email verification is required, backend returns { message } without tokens
      if (res.data.message && !res.data.accessToken) {
        setVerifyMessage(res.data.message);
        return;
      }

      const { accessToken, refreshToken, user } = res.data;
      setTokens(accessToken, refreshToken);
      setUser(user);
      router.push('/spaces');
    } catch (err: any) {
      setError(err.response?.data?.message || t('auth.register.failed'));
    }
  };

  // Registration disabled
  if (registrationEnabled === false) {
    return (
      <div key={locale} className="relative flex min-h-screen w-full items-center justify-center bg-background overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        </div>
        <div className="relative z-10 flex w-full max-w-xl flex-col items-center gap-6 px-4">
          <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <ShieldAlert className="h-7 w-7 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold">{t('auth.register.disabledTitle')}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t('auth.register.disabledDescription')}</p>
            <Link href="/login" className="mt-6 block">
              <Button variant="outline" className="h-11 w-full">{t('auth.register.backToLogin')}</Button>
            </Link>
          </div>
          <AuthFooter />
          <LanguageSwitcher compact />
        </div>
      </div>
    );
  }

  // Loading
  if (registrationEnabled === null) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show "check your email" screen after successful registration with verification required
  if (verifyMessage) {
    return (
      <div key={locale} className="relative flex min-h-screen w-full items-center justify-center bg-background overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        </div>
        <div className="relative z-10 flex w-full max-w-xl flex-col items-center gap-6 px-4">
          <WiksoLogo className="h-16 w-auto text-foreground" />
          <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <svg className="h-7 w-7 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
            </div>
            <h1 className="text-2xl font-bold">{t('auth.register.checkEmailTitle')}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t('auth.register.checkEmailDescription')}</p>
            <Link href="/login" className="mt-6 block">
              <Button variant="outline" className="h-11 w-full">{t('auth.register.backToLogin')}</Button>
            </Link>
          </div>
          <AuthFooter />
          <LanguageSwitcher compact />
        </div>
      </div>
    );
  }

  return (
    <div key={locale} className="relative flex min-h-screen w-full items-center justify-center bg-background overflow-hidden">
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
        <WiksoLogo className="h-16 w-auto text-foreground" />

        {/* Card */}
        <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{t('auth.register.title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('auth.register.description')}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('common.name')}</Label>
              <Input id="name" placeholder="John Doe" {...register('name')} className="h-11" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

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
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('auth.register.signingUp')}</>
              ) : (
                t('auth.register.button')
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              {t('auth.register.hasAccount')}{' '}
              <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
                {t('auth.register.signIn')}
              </Link>
            </p>
          </div>
        </div>

        <AuthFooter />
        <LanguageSwitcher compact />
      </div>
    </div>
  );
}
