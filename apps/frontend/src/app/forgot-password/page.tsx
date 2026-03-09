'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { ArrowLeft, Mail, Loader2, BookOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { AuthFooter } from '@/components/features/AuthFooter';
import { useTranslation } from '@/hooks/useTranslation';
import { LanguageSwitcher } from '@/components/features/LanguageSwitcher';

function createForgotSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().email(t('validation.emailInvalid')),
  });
}

type ForgotValues = z.infer<ReturnType<typeof createForgotSchema>>;

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const forgotSchema = useMemo(() => createForgotSchema(t), [t]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotValues) => {
    try {
      setError(null);
      await api.post('/auth/forgot-password', data);
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.message || t('auth.forgotPassword.failed'));
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
          {!sent ? (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold">{t('auth.forgotPassword.title')}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{t('auth.forgotPassword.description')}</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('common.email')}</Label>
                  <Input id="email" type="email" placeholder="m@example.com" {...register('email')} className="h-11" />
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>

                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <Button type="submit" className="h-11 w-full text-base" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('auth.forgotPassword.sending')}</>
                  ) : (
                    t('auth.forgotPassword.button')
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                  {t('auth.forgotPassword.backToLogin')}
                </Link>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center py-6">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold">{t('auth.forgotPassword.title')}</h2>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {t('auth.forgotPassword.sentMessage')}
              </p>
              <Link href="/login" className="mt-6 block w-full">
                <Button variant="outline" className="h-11 w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t('auth.forgotPassword.backToLogin')}
                </Button>
              </Link>
            </div>
          )}
        </div>

        <AuthFooter />
        <LanguageSwitcher compact />
      </div>
    </div>
  );
}
