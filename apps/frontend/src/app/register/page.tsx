'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);

  const registerSchema = useMemo(() => createRegisterSchema(t), [t]);

  useEffect(() => {
    api.get('/auth/settings/public')
      .then((res) => setRegistrationEnabled(res.data.registrationEnabled))
      .catch(() => setRegistrationEnabled(true)); // default to enabled on error
  }, []);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterValues) => {
    try {
      setError(null);
      const res = await api.post('/auth/register', data);

      const { accessToken, refreshToken, user } = res.data;
      setTokens(accessToken, refreshToken);
      setUser(user);
      router.push('/spaces');
    } catch (err: any) {
      setError(err.response?.data?.message || t('auth.register.failed'));
    }
  };

  // Show disabled message if registration is turned off
  if (registrationEnabled === false) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50/50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-6">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <ShieldAlert className="h-6 w-6 text-muted-foreground" />
              </div>
              <CardTitle className="text-2xl">{t('auth.register.disabledTitle')}</CardTitle>
              <CardDescription>
                {t('auth.register.disabledDescription')}
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-col space-y-4">
              <Link href="/login" className="w-full">
                <Button variant="outline" className="w-full">
                  {t('auth.register.backToLogin')}
                </Button>
              </Link>
            </CardFooter>
          </Card>
          <AuthFooter />
          <LanguageSwitcher compact />
        </div>
      </div>
    );
  }

  // Loading state
  if (registrationEnabled === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50/50 dark:bg-zinc-950">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="h-6 w-48 animate-pulse rounded bg-muted" />
              <div className="h-4 w-64 animate-pulse rounded bg-muted" />
              <div className="h-10 animate-pulse rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50/50 dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('auth.register.title')}</CardTitle>
          <CardDescription>{t('auth.register.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('common.name')}</Label>
              <Input id="name" placeholder="John Doe" {...register('name')} />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>

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
              {isSubmitting ? t('auth.register.signingUp') : t('auth.register.button')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <p className="text-center text-sm text-gray-500">
            {t('auth.register.hasAccount')}{' '}
            <Link href="/login" className="font-medium text-black dark:text-white underline">{t('auth.register.signIn')}</Link>
          </p>
        </CardFooter>
      </Card>
      <AuthFooter />
      <LanguageSwitcher compact />
      </div>
    </div>
  );
}
