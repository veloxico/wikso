'use client';

import { Key, CheckCircle2, XCircle } from 'lucide-react';
import { useAuthProviders, type AuthProviderInfo } from '@/hooks/useAdmin';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/hooks/useTranslation';

export default function AdminAuthPage() {
  const { t, locale } = useTranslation();
  const { data: authProviders, isLoading } = useAuthProviders();

  return (
    <div>
      <div className="mb-4 sm:mb-8 flex items-center gap-3">
        <Key className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
        <h1 className="text-xl sm:text-2xl font-bold">{t('admin.authProviders.title')}</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="mb-6 text-sm text-muted-foreground">
            {t('admin.authProviders.description')}
          </p>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : authProviders ? (
            <div className="space-y-4">
              {(Object.entries(authProviders) as [string, AuthProviderInfo][]).map(
                ([key, provider]) => (
                  <div
                    key={key}
                    className="flex items-start gap-4 rounded-lg border border-border p-4"
                  >
                    <div className="mt-0.5">
                      {provider.enabled ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{provider.label}</span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            provider.enabled
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          {provider.enabled ? t('common.enabled') : t('common.notConfigured')}
                        </span>
                      </div>
                      {provider.callbackUrl && provider.callbackUrl !== 'Not configured' && (
                        <p className="text-xs text-muted-foreground truncate">
                          {t('admin.authProviders.callback')}{' '}
                          <code className="bg-muted px-1 py-0.5 rounded">
                            {provider.callbackUrl}
                          </code>
                        </p>
                      )}
                      {provider.issuer && provider.issuer !== 'Not configured' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('admin.authProviders.issuer')}{' '}
                          <code className="bg-muted px-1 py-0.5 rounded">{provider.issuer}</code>
                        </p>
                      )}
                      {provider.certConfigured !== undefined && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('admin.authProviders.certificate')} {provider.certConfigured ? t('common.configured') : t('common.missing')}
                        </p>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('admin.authProviders.unableToLoad')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
