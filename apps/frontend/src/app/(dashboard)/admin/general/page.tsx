'use client';

import { useState, useEffect } from 'react';
import { Settings, Users, BarChart3, Activity, MessageSquare } from 'lucide-react';
import { useAdminStats } from '@/hooks/useAdmin';
import { useSystemSettings, useUpdateSettings } from '@/hooks/useSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AdminGeneralPage() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: settings, isLoading: settingsLoading } = useSystemSettings();
  const updateSettings = useUpdateSettings();

  const [siteName, setSiteName] = useState('');
  const [siteDescription, setSiteDescription] = useState('');

  useEffect(() => {
    if (settings) {
      setSiteName(settings.siteName);
      setSiteDescription(settings.siteDescription);
    }
  }, [settings]);

  const statCards = [
    { label: 'Users', value: stats?.totalUsers, icon: Users, color: 'text-blue-500' },
    { label: 'Spaces', value: stats?.totalSpaces, icon: BarChart3, color: 'text-green-500' },
    { label: 'Pages', value: stats?.totalPages, icon: Activity, color: 'text-purple-500' },
    { label: 'Comments', value: stats?.totalComments, icon: MessageSquare, color: 'text-orange-500' },
  ];

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <Settings className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">General Settings</h1>
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

      {/* Site Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Site Configuration</CardTitle>
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
                <label className="text-sm font-medium mb-1.5 block">Site Name</label>
                <Input
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="Dokka"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Site Description</label>
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
                {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
