'use client';

import { useState } from 'react';
import { ScrollText, Activity, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useAuditLog } from '@/hooks/useAdmin';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/useTranslation';

const PAGE_SIZE = 20;

const getActionOptions = (t: (key: string) => string) => [
  { value: '', label: t('admin.auditLog.allActions') },
  { value: 'CREATE', label: t('admin.auditLog.create') },
  { value: 'UPDATE', label: t('admin.auditLog.update') },
  { value: 'DELETE', label: t('admin.auditLog.deleteAction') },
  { value: 'LOGIN', label: t('admin.auditLog.login') },
  { value: 'LOGOUT', label: t('admin.auditLog.logout') },
  { value: 'INVITE', label: t('admin.auditLog.invite') },
];

export default function AdminAuditLogPage() {
  const { t, locale } = useTranslation();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const actionOptions = getActionOptions(t);

  const filters = {
    ...(search && { search }),
    ...(action && { action }),
    ...(dateFrom && { from: dateFrom }),
    ...(dateTo && { to: dateTo }),
  };

  const { data: auditLog, isLoading } = useAuditLog(page * PAGE_SIZE, PAGE_SIZE, filters);

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <ScrollText className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">{t('admin.auditLog.title')}</h1>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('admin.auditLog.searchPlaceholder')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={action}
              onValueChange={(v) => {
                setAction(v);
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('admin.auditLog.allActions')} />
              </SelectTrigger>
              <SelectContent>
                {actionOptions.map((opt) => (
                  <SelectItem key={opt.value || 'all'} value={opt.value || 'ALL'}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              placeholder={t('admin.auditLog.from')}
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(0);
              }}
            />
            <Input
              type="date"
              placeholder={t('admin.auditLog.to')}
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(0);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Log entries */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : auditLog && auditLog.length > 0 ? (
            <>
              <div className="space-y-2">
                {auditLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">
                          {entry.user?.name || entry.userId}
                        </span>{' '}
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            entry.action === 'DELETE'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : entry.action === 'CREATE'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}
                        >
                          {entry.action}
                        </span>{' '}
                        <span className="text-muted-foreground">{entry.entityType}</span>
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{new Date(entry.createdAt).toLocaleString(locale)}</span>
                        {entry.entityId && (
                          <span className="font-mono truncate max-w-[200px]">
                            ID: {entry.entityId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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
                    disabled={!auditLog || auditLog.length < PAGE_SIZE}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center">
              <ScrollText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{t('admin.auditLog.noEntries')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
