'use client';

import { useState, useEffect, useMemo } from 'react';
import { Settings, Users, BarChart3, Activity, MessageSquare, Eye, UserCheck } from 'lucide-react';
import { useAdminStats, useActivityStats } from '@/hooks/useAdmin';
import { useSystemSettings, useUpdateSettings } from '@/hooks/useSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/useTranslation';

function ActivityChart({ data }: { data: { date: string; users: number; pages: number; views: number }[] }) {
  const chartWidth = 700;
  const chartHeight = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  const maxViews = useMemo(() => Math.max(...data.map((d) => d.views), 1), [data]);
  const maxPages = useMemo(() => Math.max(...data.map((d) => d.pages), 1), [data]);
  const maxUsers = useMemo(() => Math.max(...data.map((d) => d.users), 1), [data]);
  const maxVal = Math.max(maxViews, maxPages, maxUsers, 1);

  const toX = (i: number) => padding.left + (i / (data.length - 1)) * innerW;
  const toY = (v: number) => padding.top + innerH - (v / maxVal) * innerH;

  const makePolyline = (key: 'pages' | 'views' | 'users') =>
    data.map((d, i) => `${toX(i)},${toY(d[key])}`).join(' ');

  const makeArea = (key: 'pages' | 'views' | 'users') => {
    const points = data.map((d, i) => `${toX(i)},${toY(d[key])}`);
    return `${toX(0)},${toY(0)} ${points.join(' ')} ${toX(data.length - 1)},${toY(0)}`;
  };

  // Y-axis ticks
  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" style={{ minWidth: 400 }}>
        {/* Grid lines */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              y1={toY(tick)}
              x2={chartWidth - padding.right}
              y2={toY(tick)}
              stroke="currentColor"
              strokeOpacity={0.1}
            />
            <text
              x={padding.left - 6}
              y={toY(tick) + 4}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize={10}
            >
              {tick}
            </text>
          </g>
        ))}

        {/* X-axis labels (every 5 days) */}
        {data.map((d, i) =>
          i % 5 === 0 ? (
            <text
              key={d.date}
              x={toX(i)}
              y={chartHeight - 5}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize={9}
            >
              {d.date.slice(5)}
            </text>
          ) : null,
        )}

        {/* Views area + line (green) */}
        <polygon points={makeArea('views')} fill="rgb(34,197,94)" fillOpacity={0.1} />
        <polyline points={makePolyline('views')} fill="none" stroke="rgb(34,197,94)" strokeWidth={2} />

        {/* Pages area + line (blue) */}
        <polygon points={makeArea('pages')} fill="rgb(59,130,246)" fillOpacity={0.1} />
        <polyline points={makePolyline('pages')} fill="none" stroke="rgb(59,130,246)" strokeWidth={2} />

        {/* Users area + line (purple) */}
        <polygon points={makeArea('users')} fill="rgb(168,85,247)" fillOpacity={0.1} />
        <polyline points={makePolyline('users')} fill="none" stroke="rgb(168,85,247)" strokeWidth={2} />
      </svg>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground justify-center">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" /> Pages
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" /> Views
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-purple-500" /> Users
        </span>
      </div>
    </div>
  );
}

export default function AdminGeneralPage() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: activityData, isLoading: activityLoading } = useActivityStats();
  const { data: settings, isLoading: settingsLoading } = useSystemSettings();
  const updateSettings = useUpdateSettings();
  const { t } = useTranslation();

  const [siteName, setSiteName] = useState('');
  const [siteDescription, setSiteDescription] = useState('');

  useEffect(() => {
    if (settings) {
      setSiteName(settings.siteName);
      setSiteDescription(settings.siteDescription);
    }
  }, [settings]);

  const statCards = [
    { label: t('admin.general.users'), value: stats?.totalUsers, icon: Users, color: 'text-blue-500' },
    { label: t('admin.general.spaces'), value: stats?.totalSpaces, icon: BarChart3, color: 'text-green-500' },
    { label: t('admin.general.pages'), value: stats?.totalPages, icon: Activity, color: 'text-purple-500' },
    { label: t('admin.general.comments'), value: stats?.totalComments, icon: MessageSquare, color: 'text-orange-500' },
  ];

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <Settings className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t('admin.general.title')}</h1>
          {settings?.appVersion && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('admin.general.version', { version: settings.appVersion })}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="h-8 w-16 animate-pulse rounded bg-muted" />
                ) : (
                  <p className="text-2xl font-bold">{stat.value ?? 0}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Activity Chart */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Activity (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="h-[230px] animate-pulse rounded bg-muted" />
          ) : activityData && activityData.length > 0 ? (
            <ActivityChart data={activityData} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No activity data available</p>
          )}
        </CardContent>
      </Card>

      {/* Site Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.general.siteConfig')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingsLoading ? (
            <div className="space-y-3">
              <div className="h-10 animate-pulse rounded bg-muted" />
              <div className="h-10 animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('admin.general.siteName')}</label>
                <Input
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="Wikso"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('admin.general.siteDescription')}</label>
                <Input
                  value={siteDescription}
                  onChange={(e) => setSiteDescription(e.target.value)}
                  placeholder="A modern wiki & knowledge base"
                />
              </div>
              <Button
                onClick={() => updateSettings.mutate({ siteName, siteDescription })}
                disabled={updateSettings.isPending}
              >
                {updateSettings.isPending ? t('common.saving') : t('admin.general.saveSettings')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
