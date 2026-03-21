'use client';

import { Activity, Database, Server, Cpu, RefreshCw, HardDrive } from 'lucide-react';
import { useSystemHealth } from '@/hooks/useAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  return parts.join(' ');
}

function StatusIndicator({ status }: { status: string }) {
  const isUp = status === 'up';
  return (
    <span
      className={`inline-flex h-3 w-3 rounded-full ${
        isUp ? 'bg-green-500' : 'bg-red-500'
      }`}
    />
  );
}

export default function AdminHealthPage() {
  const { data: health, isLoading, dataUpdatedAt } = useSystemHealth();

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : '';

  const services = health?.checks
    ? Object.entries(health.checks).map(([name, check]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        status: check.status,
        message: check.message,
      }))
    : [];

  const memPercent =
    health?.memoryUsage
      ? Math.round((health.memoryUsage.heapUsed / health.memoryUsage.heapTotal) * 100)
      : 0;

  return (
    <div>
      <div className="mb-4 sm:mb-8 flex items-center gap-3">
        <Activity className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">System Health</h1>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Auto-refreshes every 30s &middot; Last: {lastUpdated}
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : health ? (
        <>
          {/* Overall status */}
          <Card className="mb-6">
            <CardContent className="pt-6 flex items-center gap-3">
              <span
                className={`inline-flex h-4 w-4 rounded-full ${
                  health.status === 'ok' ? 'bg-green-500' : 'bg-yellow-500'
                }`}
              />
              <span className="text-lg font-semibold">
                {health.status === 'ok' ? 'All Systems Operational' : 'Degraded Performance'}
              </span>
            </CardContent>
          </Card>

          {/* Service status cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {services.map((svc) => (
              <Card key={svc.name}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {svc.name}
                  </CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  <StatusIndicator status={svc.status} />
                  <span className="text-sm font-medium">
                    {svc.status === 'up' ? 'Connected' : 'Down'}
                  </span>
                  {svc.message && (
                    <span className="ml-2 text-xs text-red-500 truncate max-w-[100px] sm:max-w-[180px]" title={svc.message}>
                      {svc.message}
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* System info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Uptime */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Uptime</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{formatUptime(health.uptime)}</p>
              </CardContent>
            </Card>

            {/* Memory Usage */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Memory Usage</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="text-xl font-bold">
                    {health.memoryUsage.heapUsed} MB
                  </span>
                  <span className="text-sm text-muted-foreground">
                    / {health.memoryUsage.heapTotal} MB ({memPercent}%)
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      memPercent > 85 ? 'bg-red-500' : memPercent > 60 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${memPercent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  RSS: {health.memoryUsage.rss} MB
                </p>
              </CardContent>
            </Card>

            {/* Disk Usage */}
            {health.diskUsage && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Disk Usage</CardTitle>
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="mb-2 flex items-baseline gap-2">
                    <span className="text-xl font-bold">
                      {health.diskUsage.usedGB} GB
                    </span>
                    <span className="text-sm text-muted-foreground">
                      / {health.diskUsage.totalGB} GB ({health.diskUsage.usedPercent}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted">
                    <div
                      className={`h-2.5 rounded-full transition-all ${
                        health.diskUsage.usedPercent > 90
                          ? 'bg-red-500'
                          : health.diskUsage.usedPercent > 75
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${health.diskUsage.usedPercent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Free: {health.diskUsage.freeGB} GB
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Node Version */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Node.js Version</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold font-mono">{health.nodeVersion}</p>
              </CardContent>
            </Card>

            {/* App Version */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">App Version</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold font-mono">{health.version}</p>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">Unable to load health data.</p>
      )}
    </div>
  );
}
