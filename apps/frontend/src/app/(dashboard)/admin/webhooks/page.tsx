'use client';

import { useState } from 'react';
import { Webhook, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAdminWebhooks, useToggleWebhook } from '@/hooks/useAdmin';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';

const PAGE_SIZE = 20;

export default function AdminWebhooksPage() {
  const { t, locale } = useTranslation();
  const [page, setPage] = useState(0);
  const { data: webhooks, isLoading } = useAdminWebhooks(page * PAGE_SIZE, PAGE_SIZE);
  const toggleWebhook = useToggleWebhook();

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <Webhook className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">{t('admin.webhooks.title')}</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : webhooks && webhooks.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.webhooks.urlColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.webhooks.eventsColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.webhooks.statusColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.webhooks.createdColumn')}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.webhooks.actionsColumn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webhooks.map((webhook) => (
                      <tr key={webhook.id} className="border-b border-border last:border-0">
                        <td className="py-3 max-w-[300px]">
                          <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded truncate block">
                            {webhook.url}
                          </code>
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1">
                            {webhook.events.map((event) => (
                              <span
                                key={event}
                                className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              >
                                {event}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              webhook.active
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                            }`}
                          >
                            {webhook.active ? t('common.active') : t('common.inactive')}
                          </span>
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {new Date(webhook.createdAt).toLocaleDateString(locale)}
                        </td>
                        <td className="py-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              toggleWebhook.mutate({
                                id: webhook.id,
                                active: !webhook.active,
                              })
                            }
                          >
                            {webhook.active ? t('common.disable') : t('common.enable')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t('common.pageNum', { num: page + 1 })}</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!webhooks || webhooks.length < PAGE_SIZE}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center">
              <Webhook className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{t('admin.webhooks.noWebhooks')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
