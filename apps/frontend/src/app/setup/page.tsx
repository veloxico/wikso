'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import {
  Rocket,
  Users,
  FileText,
  Search,
  Shield,
  ArrowRight,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
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

const features = [
  { icon: FileText, labelKey: 'setup.welcome.featurePages' },
  { icon: Users, labelKey: 'setup.welcome.featureCollaboration' },
  { icon: Search, labelKey: 'setup.welcome.featureSearch' },
  { icon: Shield, labelKey: 'setup.welcome.featureAdmin' },
];

export default function SetupPage() {
  const router = useRouter();
  const { setUser, setTokens } = useAuthStore();
  const { t } = useTranslation();
  const [step, setStep] = useState<'welcome' | 'admin'>('welcome');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

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
          requestAnimationFrame(() => setVisible(true));
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

  const handleContinue = () => {
    setVisible(false);
    setTimeout(() => {
      setStep('admin');
      requestAnimationFrame(() => setVisible(true));
    }, 300);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Step 1: Welcome
  if (step === 'welcome') {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gray-50 dark:bg-zinc-950">
        {/* Background decorative elements */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute left-1/2 top-1/4 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/[0.03] blur-3xl" />
        </div>

        <div
          className="relative z-10 flex w-full max-w-xl flex-col items-center gap-8 px-6 transition-all duration-700 ease-out"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(24px)',
          }}
        >
          {/* Rocket icon with glow */}
          <div className="relative">
            <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-xl" />
            <div className="setup-rocket-box relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10">
              <Rocket className="setup-rocket h-10 w-10 text-primary" />
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-3 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              {t('setup.welcome.title')}
            </h1>
            <p className="mx-auto max-w-md text-lg text-muted-foreground">
              {t('setup.welcome.description')}
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid w-full grid-cols-2 gap-3">
            {features.map(({ icon: Icon, labelKey }, i) => (
              <div
                key={labelKey}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm transition-all duration-500 ease-out hover:border-primary/20 hover:bg-card"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(16px)',
                  transitionDelay: `${200 + i * 100}ms`,
                }}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-[18px] w-[18px] text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">{t(labelKey)}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(16px)',
              transition: 'all 0.7s ease-out',
              transitionDelay: '600ms',
            }}
          >
            <Button
              size="lg"
              className="group gap-2 px-8 text-base"
              onClick={handleContinue}
            >
              {t('setup.welcome.continue')}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>

          {/* Footer */}
          <div
            className="flex flex-col items-center gap-3"
            style={{
              opacity: visible ? 1 : 0,
              transition: 'opacity 0.7s ease-out',
              transitionDelay: '700ms',
            }}
          >
            <AuthFooter />
            <LanguageSwitcher compact />
          </div>
        </div>

        <style>{`
          .setup-rocket {
            animation: setupFloat 3s ease-in-out infinite;
          }
          @keyframes setupFloat {
            0%, 100% { transform: translateY(0) rotate(-12deg); }
            50% { transform: translateY(-6px) rotate(-12deg); }
          }
        `}</style>
      </div>
    );
  }

  // Step 2: Admin creation form
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gray-50 dark:bg-zinc-950">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div
        className="relative z-10 flex w-full max-w-lg flex-col items-center gap-6 px-6 transition-all duration-700 ease-out"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(24px)',
        }}
      >
        <Card className="w-full">
          <CardHeader className="pb-4">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-2xl">{t('setup.admin.title')}</CardTitle>
            <CardDescription>{t('setup.admin.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
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

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full gap-2" size="lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('setup.admin.creating')}
                  </>
                ) : (
                  <>
                    {t('setup.admin.button')}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center gap-3">
          <AuthFooter />
          <LanguageSwitcher compact />
        </div>
      </div>
    </div>
  );
}
