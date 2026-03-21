'use client';

import { useState, useEffect, useMemo } from 'react';
import { Settings, Users, BarChart3, Activity, MessageSquare } from 'lucide-react';
import { useAdminStats, useActivityStats } from '@/hooks/useAdmin';
import { useSystemSettings, useUpdateSettings } from '@/hooks/useSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/useTranslation';

const PERIOD_OPTIONS = [
  { value: '12h', label: '12h' },
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '14d', label: '14d' },
  { value: '30d', label: '30d' },
] as const;

function formatXLabel(dateStr: string, period: string): string {
  if (['12h', '6h', '24h'].includes(period)) {
    // Hourly data — show HH:mm
    const d = new Date(dateStr);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  // Daily data — show MM-DD
  return dateStr.slice(5, 10);
}

function getXLabelInterval(dataLength: number, period: string): number {
  if (period === '12h') return 2;
  if (period === '6h') return 1;
  if (period === '24h') return 3;
  if (period === '7d') return 1;
  if (period === '14d') return 2;
  return 5; // 30d
}

interface ActivityChartProps {
  data: { date: string; users: number; pages: number; views: number }[];
  period: string;
}

function ActivityChart({ data, period }: ActivityChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const chartWidth = 700;
  const chartHeight = 220;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  const maxVal = useMemo(() => {
    const max = Math.max(
      ...data.map((d) => d.views),
      ...data.map((d) => d.pages),
      ...data.map((d) => d.users),
      1,
    );
    return max;
  }, [data]);

  const totals = useMemo(() => ({
    views: data.reduce((s, d) => s + d.views, 0),
    pages: data.reduce((s, d) => s + d.pages, 0),
    users: data.reduce((s, d) => s + d.users, 0),
  }), [data]);

  const toX = (i: number) => padding.left + (i / Math.max(data.length - 1, 1)) * innerW;
  const toY = (v: number) => padding.top + innerH - (v / maxVal) * innerH;

  const makePolyline = (key: 'pages' | 'views' | 'users') =>
    data.map((d, i) => `${toX(i)},${toY(d[key])}`).join(' ');

  const makeArea = (key: 'pages' | 'views' | 'users') => {
    const points = data.map((d, i) => `${toX(i)},${toY(d[key])}`);
    return `${toX(0)},${toY(0)} ${points.join(' ')} ${toX(data.length - 1)},${toY(0)}`;
  };

  const yTicks = [...new Set([0, Math.round(maxVal / 4), Math.round(maxVal / 2), Math.round(maxVal * 3 / 4), maxVal])];
  const labelInterval = getXLabelInterval(data.length, period);

  return (
    <div className="w-full">
      {/* Summary stats */}
      <div className="mb-4 flex flex-wrap items-center gap-3 sm:gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
          <span className="text-muted-foreground">Views:</span>
          <span className="font-semibold">{totals.views.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
          <span className="text-muted-foreground">Pages:</span>
          <span className="font-semibold">{totals.pages.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-purple-500" />
          <span className="text-muted-foreground">Users:</span>
          <span className="font-semibold">{totals.users.toLocaleString()}</span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full"
          style={{ minWidth: 400 }}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Grid lines */}
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={toY(tick)}
                x2={chartWidth - padding.right}
                y2={toY(tick)}
                stroke="currentColor"
                strokeOpacity={0.08}
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

          {/* X-axis labels */}
          {data.map((d, i) =>
            i % labelInterval === 0 ? (
              <text
                key={i}
                x={toX(i)}
                y={chartHeight - 5}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={9}
              >
                {formatXLabel(d.date, period)}
              </text>
            ) : null,
          )}

          {/* Views area + line (green) */}
          <polygon points={makeArea('views')} fill="rgb(34,197,94)" fillOpacity={0.08} />
          <polyline points={makePolyline('views')} fill="none" stroke="rgb(34,197,94)" strokeWidth={2} />

          {/* Pages area + line (blue) */}
          <polygon points={makeArea('pages')} fill="rgb(59,130,246)" fillOpacity={0.08} />
          <polyline points={makePolyline('pages')} fill="none" stroke="rgb(59,130,246)" strokeWidth={2} />

          {/* Users area + line (purple) */}
          <polygon points={makeArea('users')} fill="rgb(168,85,247)" fillOpacity={0.08} />
          <polyline points={makePolyline('users')} fill="none" stroke="rgb(168,85,247)" strokeWidth={2} />

          {/* Hover interaction areas */}
          {data.map((d, i) => (
            <g key={i}>
              <rect
                x={toX(i) - innerW / data.length / 2}
                y={padding.top}
                width={innerW / data.length}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHoveredIdx(i)}
              />
              {hoveredIdx === i && (
                <>
                  <line
                    x1={toX(i)}
                    y1={padding.top}
                    x2={toX(i)}
                    y2={padding.top + innerH}
                    stroke="currentColor"
                    strokeOpacity={0.2}
                    strokeDasharray="4 2"
                  />
                  <circle cx={toX(i)} cy={toY(d.views)} r={3.5} fill="rgb(34,197,94)" />
                  <circle cx={toX(i)} cy={toY(d.pages)} r={3.5} fill="rgb(59,130,246)" />
                  <circle cx={toX(i)} cy={toY(d.users)} r={3.5} fill="rgb(168,85,247)" />
                </>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Tooltip */}
      {hoveredIdx !== null && data[hoveredIdx] && (
        <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-muted-foreground justify-center bg-muted/50 rounded-md py-1.5 px-3">
          <span className="font-medium text-foreground">{formatXLabel(data[hoveredIdx].date, period)}</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            {data[hoveredIdx].views}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
            {data[hoveredIdx].pages}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
            {data[hoveredIdx].users}
          </span>
        </div>
      )}
    </div>
  );
}

export default function AdminGeneralPage() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const [activityPeriod, setActivityPeriod] = useState('7d');
  const { data: activityData, isLoading: activityLoading, isFetching: activityFetching } = useActivityStats(activityPeriod);
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
      <div className="mb-4 sm:mb-8 flex items-center gap-3">
        <Settings className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t('admin.general.title')}</h1>
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
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Activity
          </CardTitle>
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1 flex-wrap">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setActivityPeriod(opt.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activityPeriod === opt.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="h-[280px] animate-pulse rounded bg-muted" />
          ) : activityData && activityData.length > 0 ? (
            <div className={`transition-opacity duration-200 ${activityFetching ? 'opacity-60' : ''}`}>
              <ActivityChart data={activityData} period={activityPeriod} />
            </div>
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
