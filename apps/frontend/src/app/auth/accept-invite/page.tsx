'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { AuthFooter } from '@/components/features/AuthFooter';
import { useTranslation } from '@/hooks/useTranslation';
import { LanguageSwitcher } from '@/components/features/LanguageSwitcher';

function createAcceptInviteSchema(t: (key: string) => string) {
  return z
    .object({
      name: z.string().min(2, t('validation.nameMin2')),
      password: z.string().min(6, t('validation.passwordMin6')),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('validation.passwordsDoNotMatch'),
      path: ['confirmPassword'],
    });
}

type AcceptInviteValues = z.infer<ReturnType<typeof createAcceptInviteSchema>>;

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { setUser, setTokens } = useAuthStore();
  const { t } = useTranslation();

  const [error, setError] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<{ email: string; name?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  const acceptInviteSchema = useMemo(() => createAcceptInviteSchema(t), [t]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AcceptInviteValues>({
    resolver: zodResolver(acceptInviteSchema),
  });

  useEffect(() => {
    if (!token) {
      setInvalid(true);
      setLoading(false);
      return;
    }

    api
      .get(`/auth/invite/${token}`)
      .then((res) => {
        setInviteData(res.data);
        if (res.data.name) {
          setValue('name', res.data.name);
        }
      })
      .catch(() => {
        setInvalid(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token, setValue]);

  const onSubmit = async (data: AcceptInviteValues) => {
    try {
      setError(null);
      const res = await api.post('/auth/accept-invite', {
        token,
        name: data.name,
        password: data.password,
      });

      const { accessToken, refreshToken, user } = res.data;
      setTokens(accessToken, refreshToken);
      setUser(user);
      router.push('/spaces');
    } catch (err: any) {
      setError(err.response?.data?.message || t('auth.acceptInvite.failed'));
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded bg-muted" />
            <div className="h-10 animate-pulse rounded bg-muted" />
            <div className="h-10 animate-pulse rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (invalid) {
    return (
      <div className="flex flex-col items-center gap-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">{t('auth.acceptInvite.invalidTitle')}</CardTitle>
            <CardDescription>
              {t('auth.acceptInvite.invalidDescription')}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/login" className="w-full">
              <Button variant="outline" className="w-full">
                {t('auth.acceptInvite.goToLogin')}
              </Button>
            </Link>
          </CardFooter>
        </Card>
        <AuthFooter />
        <LanguageSwitcher compact />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('auth.acceptInvite.title')}</CardTitle>
          <CardDescription>
            {t('auth.acceptInvite.description', { email: inviteData?.email || '' })}
          </CardDescription>
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
              <Input id="email" type="email" value={inviteData?.email || ''} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('common.password')}</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('auth.acceptInvite.confirmPassword')}</Label>
              <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t('auth.acceptInvite.settingUp') : t('auth.acceptInvite.button')}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-center text-sm text-gray-500 w-full">
            {t('auth.register.hasAccount')}{' '}
            <Link href="/login" className="font-medium text-black dark:text-white underline">
              {t('auth.register.signIn')}
            </Link>
          </p>
        </CardFooter>
      </Card>
      <AuthFooter />
      <LanguageSwitcher compact />
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50/50 dark:bg-zinc-950">
      <Suspense
        fallback={
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="h-6 w-48 animate-pulse rounded bg-muted" />
                <div className="h-4 w-64 animate-pulse rounded bg-muted" />
                <div className="h-10 animate-pulse rounded bg-muted" />
                <div className="h-10 animate-pulse rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        }
      >
        <AcceptInviteForm />
      </Suspense>
    </div>
  );
}
