'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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

  const forgotSchema = useMemo(() => createForgotSchema(t), [t]);

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
    <div className="flex h-screen w-full items-center justify-center bg-gray-50/50 dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('auth.forgotPassword.title')}</CardTitle>
          <CardDescription>
            {sent
              ? t('auth.forgotPassword.descriptionSent')
              : t('auth.forgotPassword.description')}
          </CardDescription>
        </CardHeader>
        {!sent ? (
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('common.email')}</Label>
                <Input id="email" type="email" placeholder="m@example.com" {...register('email')} />
                {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? t('auth.forgotPassword.sending') : t('auth.forgotPassword.button')}
              </Button>
            </form>
          </CardContent>
        ) : (
          <CardContent>
            <div className="flex flex-col items-center py-4">
              <Mail className="mb-4 h-12 w-12 text-primary" />
              <p className="text-center text-sm text-muted-foreground">
                {t('auth.forgotPassword.sentMessage')}
              </p>
            </div>
          </CardContent>
        )}
        <CardFooter>
          <Link href="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            {t('auth.forgotPassword.backToLogin')}
          </Link>
        </CardFooter>
      </Card>
      <AuthFooter />
      <LanguageSwitcher compact />
      </div>
    </div>
  );
}
