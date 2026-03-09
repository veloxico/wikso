'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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

  const loginSchema = useMemo(() => createLoginSchema(t), [t]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    api.get('/auth/providers')
      .then((res) => setProviders(res.data))
      .catch(() => setProviders({ github: false, google: false, saml: false }));

    api.get('/auth/settings/public')
      .then((res) => setRegistrationEnabled(res.data.registrationEnabled))
      .catch(() => setRegistrationEnabled(true));
  }, []);

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
    <div className="flex h-screen w-full items-center justify-center bg-gray-50/50 dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('auth.login.title')}</CardTitle>
          <CardDescription>{t('auth.login.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('common.email')}</Label>
              <Input id="email" type="email" placeholder="m@example.com" {...register('email')} />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('common.password')}</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t('auth.login.loggingIn') : t('auth.login.button')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          {hasOAuth && (
            <>
              <div className="relative w-full text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:-translate-y-1/2 after:border-t after:border-gray-200 dark:after:border-gray-800">
                <span className="relative z-10 bg-white px-2 text-gray-500 dark:bg-zinc-950 dark:text-gray-400">{t('common.orContinueWith')}</span>
              </div>
              <div className="grid w-full gap-2" style={{ gridTemplateColumns: `repeat(${[providers.github, providers.google, providers.saml].filter(Boolean).length}, 1fr)` }}>
                {providers.github && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => { window.location.href = `${base}/api/auth/github`; }}
                  >
                    GitHub
                  </Button>
                )}
                {providers.google && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => { window.location.href = `${base}/api/auth/google`; }}
                  >
                    Google
                  </Button>
                )}
                {providers.saml && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => { window.location.href = `${base}/api/auth/saml`; }}
                  >
                    SSO (SAML)
                  </Button>
                )}
              </div>
            </>
          )}
          <div className="flex flex-col items-center gap-2 text-sm text-gray-500">
            <Link href="/forgot-password" className="hover:text-foreground underline">{t('auth.login.forgotPassword')}</Link>
            {registrationEnabled && (
              <p>
                {t('auth.login.noAccount')}{' '}
                <Link href="/register" className="font-medium text-black dark:text-white underline">{t('auth.login.signUp')}</Link>
              </p>
            )}
          </div>
        </CardFooter>
      </Card>
      <AuthFooter />
      <LanguageSwitcher compact />
      </div>
    </div>
  );
}
