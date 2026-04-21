'use client';

import { useMemo, useState } from 'react';
import { BarChart3, Eye, Loader2, Sparkles, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/useTranslation';
import {
  usePageAnalytics,
  type AnalyticsPeriod,
  type PageAnalytics,
} from '@/hooks/usePageAnalytics';
import { cn } from '@/lib/utils';

interface PageStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  pageId: string;
  pageTitle: string;
}

const PERIODS: AnalyticsPeriod[] = ['7d', '30d', '90d'];

/**
 * Per-page analytics dialog. Three KPIs across the top, then a custom SVG
 * bar chart for the daily trend. The chart is hand-drawn (no recharts
 * dependency) so we can give it a tighter, editorial look — gradient bars,
 * subtle baseline grid, hover tooltip — without paying the bundle tax.
 */
export function PageStatsDialog({
  open,
  onOpenChange,
  slug,
  pageId,
  pageTitle,
}: PageStatsDialogProps) {
  const { t, locale } = useTranslation();
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const { data, isLoading } = usePageAnalytics(slug, pageId, period, open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            {t('analytics.title') || 'Page analytics'}
          </DialogTitle>
          <DialogDescription>
            {t('analytics.description') || 'How often this page is read, and by how many distinct people.'}
            {pageTitle ? (
              <span className="mt-1 block truncate text-foreground/80">“{pageTitle}”</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {/* Period selector */}
        <div className="flex items-center justify-between">
          <div className="inline-flex rounded-lg border bg-card/40 p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  p === period
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(`analytics.period.${p}`) || p}
              </button>
            ))}
          </div>
          {data ? (
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              {t('analytics.since') || 'Since'} {new Date(data.since).toLocaleDateString(locale)}
            </span>
          ) : null}
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-2">
          <KpiCard
            icon={<Eye className="h-3.5 w-3.5" />}
            label={t('analytics.totalViews') || 'Total views'}
            value={data?.totalViews ?? 0}
            loading={isLoading}
            tone="default"
          />
          <KpiCard
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label={t('analytics.viewsInPeriod') || 'In period'}
            value={data?.viewsInPeriod ?? 0}
            loading={isLoading}
            tone="primary"
          />
          <KpiCard
            icon={<Users className="h-3.5 w-3.5" />}
            label={t('analytics.uniqueViewers') || 'Unique readers'}
            value={data?.uniqueViewers ?? 0}
            loading={isLoading}
            tone="accent"
          />
        </div>

        {/* Trend chart */}
        <div className="rounded-xl border border-border/60 bg-card/40 p-4">
          {isLoading || !data ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('analytics.loading') || 'Loading…'}
            </div>
          ) : (
            <TrendChart data={data} locale={locale} t={t} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────────────────────────────────────────────────────
//   KPI card
// ───────────────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  loading,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
  tone: 'default' | 'primary' | 'accent';
}) {
  const toneClass = {
    default: 'text-foreground',
    primary: 'text-primary',
    accent: 'text-emerald-500 dark:text-emerald-400',
  }[tone];

  return (
    <div className="rounded-lg border border-border/60 bg-card/30 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={cn('mt-1 text-2xl font-semibold tabular-nums', toneClass)}>
        {loading ? '—' : value.toLocaleString()}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
//   Trend chart (custom SVG)
// ───────────────────────────────────────────────────────────────────────────

function TrendChart({
  data,
  locale,
  t,
}: {
  data: PageAnalytics;
  locale: string;
  t: (key: string) => string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Geometry — viewBox in unit space so it scales with the parent width.
  const W = 600;
  const H = 180;
  const PAD_L = 32;
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = 24;

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const max = useMemo(
    () => Math.max(1, ...data.dailyCounts.map((d) => d.views)),
    [data.dailyCounts],
  );
  const niceMax = useMemo(() => roundUpNice(max), [max]);

  const n = data.dailyCounts.length;
  const barGap = 2;
  const barW = Math.max(1, innerW / n - barGap);

  const yTicks = [0, niceMax / 2, niceMax];

  const hovered = hoverIdx !== null ? data.dailyCounts[hoverIdx] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Daily views">
        <defs>
          <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" className="text-primary" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.35" className="text-primary" />
          </linearGradient>
        </defs>

        {/* Gridlines + Y axis labels */}
        {yTicks.map((tk, i) => {
          const y = PAD_T + innerH - (tk / niceMax) * innerH;
          return (
            <g key={i}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={y}
                y2={y}
                className="stroke-border"
                strokeDasharray={i === 0 ? undefined : '2 3'}
                strokeWidth={i === 0 ? 1 : 0.5}
              />
              <text
                x={PAD_L - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-muted-foreground text-[9px] tabular-nums"
              >
                {Math.round(tk)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.dailyCounts.map((d, i) => {
          const h = (d.views / niceMax) * innerH;
          const x = PAD_L + i * (innerW / n);
          const y = PAD_T + innerH - h;
          const active = i === hoverIdx;
          return (
            <g
              key={d.date}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{ cursor: 'default' }}
            >
              {/* Larger invisible hit area for hover */}
              <rect
                x={x}
                y={PAD_T}
                width={innerW / n}
                height={innerH}
                fill="transparent"
              />
              <rect
                x={x + 0.5}
                y={d.views > 0 ? y : PAD_T + innerH - 1}
                width={Math.max(1, barW)}
                height={d.views > 0 ? Math.max(1, h) : 1}
                rx={1.5}
                fill={d.views > 0 ? 'url(#bar-grad)' : 'currentColor'}
                className={cn('text-primary', active ? 'opacity-100' : 'opacity-90')}
              />
            </g>
          );
        })}

        {/* X axis labels — first, mid, last */}
        {n > 0 ? (
          <>
            <DateLabel
              date={data.dailyCounts[0].date}
              x={PAD_L}
              y={H - 6}
              anchor="start"
              locale={locale}
            />
            <DateLabel
              date={data.dailyCounts[Math.floor(n / 2)].date}
              x={PAD_L + innerW / 2}
              y={H - 6}
              anchor="middle"
              locale={locale}
            />
            <DateLabel
              date={data.dailyCounts[n - 1].date}
              x={W - PAD_R}
              y={H - 6}
              anchor="end"
              locale={locale}
            />
          </>
        ) : null}
      </svg>

      {/* Tooltip */}
      {hovered ? (
        <div className="pointer-events-none absolute right-4 top-2 rounded-md border border-border/60 bg-popover/95 px-2 py-1 text-[11px] shadow-sm backdrop-blur">
          <div className="font-medium text-foreground">
            {new Date(hovered.date).toLocaleDateString(locale, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </div>
          <div className="text-muted-foreground">
            <span className="text-primary">{hovered.views}</span>{' '}
            {t('analytics.views') || 'views'}
            {hovered.uniqueUsers > 0 ? (
              <>
                {' · '}
                <span className="text-emerald-500 dark:text-emerald-400">
                  {hovered.uniqueUsers}
                </span>{' '}
                {t('analytics.uniques') || 'unique'}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DateLabel({
  date,
  x,
  y,
  anchor,
  locale,
}: {
  date: string;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  locale: string;
}) {
  const label = new Date(date).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });
  return (
    <text x={x} y={y} textAnchor={anchor} className="fill-muted-foreground text-[9px]">
      {label}
    </text>
  );
}

/** Round up to a "nice" number for the chart's Y axis ceiling. */
function roundUpNice(n: number): number {
  if (n <= 5) return 5;
  if (n <= 10) return 10;
  if (n <= 20) return 20;
  if (n <= 50) return 50;
  if (n <= 100) return 100;
  if (n <= 200) return 200;
  if (n <= 500) return 500;
  if (n <= 1000) return 1000;
  // Fallback: round up to next power-of-ten-multiple
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  return Math.ceil(n / pow) * pow;
}
