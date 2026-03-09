'use client';

import { Mail, CheckCircle2, XCircle, Send } from 'lucide-react';
import { useEmailStatus, useTestEmail } from '@/hooks/useAdmin';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';

export default function AdminEmailPage() {
  const { t, locale } = useTranslation();
  const { data: emailStatus, isLoading } = useEmailStatus();
  const testEmail = useTestEmail();

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <Mail className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">{t('admin.email.title')}</h1>
      </div>

      <div className="space-y-6">
        {/* SMTP Status */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-4 text-lg font-semibold">{t('admin.email.smtpStatus')}</h2>
            {isLoading ? (
              <div className="space-y-3">
                <div className="h-12 animate-pulse rounded bg-muted" />
                <div className="h-12 animate-pulse rounded bg-muted" />
              </div>
            ) : emailStatus ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border border-border p-4">
                  {emailStatus.configured ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                  <div>
                    <p className="font-medium">
                      {emailStatus.configured ? t('admin.email.smtpConfigured') : t('admin.email.smtpNotConfigured')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {emailStatus.configured
                        ? t('admin.email.smtpReady')
                        : t('admin.email.smtpSetup')}
                    </p>
                  </div>
                </div>

                {emailStatus.configured && (
                  <div className="rounded-lg border border-border p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">{t('admin.email.host')}</p>
                        <p className="text-sm font-mono">{emailStatus.host || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">{t('admin.email.port')}</p>
                        <p className="text-sm font-mono">{emailStatus.port || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">{t('admin.email.from')}</p>
                        <p className="text-sm font-mono">{emailStatus.from || '—'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('admin.email.unableToLoad')}</p>
            )}
          </CardContent>
        </Card>

        {/* Test Email */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-2 text-lg font-semibold">{t('admin.email.sendTestEmail')}</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {t('admin.email.testEmailDescription')}
            </p>
            <Button
              onClick={() => testEmail.mutate()}
              disabled={testEmail.isPending || !emailStatus?.configured}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {testEmail.isPending ? t('common.sending') : t('admin.email.sendTestEmail')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
