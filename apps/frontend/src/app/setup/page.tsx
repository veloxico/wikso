'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Rocket } from 'lucide-react';

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

function createSetupSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, t('validation.nameMin2')),
    email: z.string().email(t('validation.emailInvalid')),
    password: z.string().min(8, t('validation.passwordMin8')),
    instanceName: z.string().optional(),
  });
}

type SetupValues = z.infer<ReturnType<typeof createSetupSchema>>;

export default function SetupPage() {
  const router = useRouter();
  const { setUser, setTokens } = useAuthStore();
  const { t } = useTranslation();
  const [step, setStep] = useState<'welcome' | 'admin'>('welcome');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setupSchema = useMemo(() => createSetupSchema(t), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
  });

  // Security: check if setup is actually needed
  useEffect(() => {
    api
      .get('/setup/status')
      .then((res) => {
        if (!res.data.setupRequired) {
          router.replace('/login');
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        router.replace('/login');
      });
  }, [router]);

  const onSubmit = async (data: SetupValues) => {
    try {
      setError(null);
      const res = await api.post('/setup/init', data);
      const { accessToken, refreshToken, user } = res.data;
      setTokens(accessToken, refreshToken);
      setUser(user);
      router.push('/spaces');
    } catch (err: any) {
      setError(err.response?.data?.message || t('setup.failed'));
    }
  };

  // Loading state while checking setup status
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50/50 dark:bg-zinc-950">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-muted" />
              <div className="mx-auto h-6 w-48 animate-pulse rounded bg-muted" />
              <div className="mx-auto h-4 w-64 animate-pulse rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 1: Welcome
  if (step === 'welcome') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50/50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-6">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Rocket className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">{t('setup.welcome.title')}</CardTitle>
              <CardDescription className="text-base">
                {t('setup.welcome.description')}
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button className="w-full" size="lg" onClick={() => setStep('admin')}>
                {t('setup.welcome.continue')}
              </Button>
            </CardFooter>
          </Card>
          <AuthFooter />
          <LanguageSwitcher compact />
        </div>
      </div>
    );
  }

  // Step 2: Admin creation form
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50/50 dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">{t('setup.admin.title')}</CardTitle>
            <CardDescription>{t('setup.admin.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('common.name')}</Label>
                <Input id="name" placeholder="Admin" {...register('name')} />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t('common.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t('common.password')}</Label>
                <Input id="password" type="password" {...register('password')} />
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="instanceName">{t('setup.admin.instanceName')}</Label>
                <Input
                  id="instanceName"
                  placeholder="My Wiki"
                  {...register('instanceName')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('setup.admin.instanceNameHint')}
                </p>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? t('setup.admin.creating') : t('setup.admin.button')}
              </Button>
            </form>
          </CardContent>
        </Card>
        <AuthFooter />
        <LanguageSwitcher compact />
      </div>
    </div>
  );
}
