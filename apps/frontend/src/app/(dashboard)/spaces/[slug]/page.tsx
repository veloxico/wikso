'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FileText, Users, Clock, Globe, Lock, User, Activity, ArrowRight, Settings } from 'lucide-react';
import { useSpace, useSpaceMembers } from '@/hooks/useSpaces';
import { usePages } from '@/hooks/usePages';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const spaceTypeIcon: Record<string, React.ElementType> = {
  PUBLIC: Globe,
  PRIVATE: Lock,
  PERSONAL: User,
};

export default function SpacePage() {
  const params = useParams();
  const slug = params.slug as string;
  const { data: space } = useSpace(slug);
  const { data: pages } = usePages(slug);
  const { data: members } = useSpaceMembers(slug);
  const { t, locale } = useTranslation();

  const TypeIcon = spaceTypeIcon[space?.type || 'PUBLIC'] || Globe;

  // Get recent pages (sorted by updatedAt)
  const recentPages = pages
    ? [...flattenPages(pages)]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 8)
    : [];

  const totalPages = pages ? flattenPages(pages).length : 0;

  return (
    <div className="p-8">
      {/* Space header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <TypeIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{space?.name || t('common.loading')}</h1>
              {space?.description && (
                <p className="text-muted-foreground">{space.description}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" asChild title={t('spaces.settings.title')}>
            <Link href={`/spaces/${slug}/settings`}>
              <Settings className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalPages}</p>
              <p className="text-xs text-muted-foreground">{t('spaces.totalPages') || 'Pages'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{members?.length || 0}</p>
              <p className="text-xs text-muted-foreground">{t('spaces.members') || 'Members'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {space?.updatedAt ? new Date(space.updatedAt).toLocaleDateString(locale) : '\u2014'}
              </p>
              <p className="text-xs text-muted-foreground">{t('spaces.lastUpdated') || 'Last updated'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent pages */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                {t('spaces.recentlyUpdated') || 'Recently Updated'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {recentPages.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">{t('spaces.noPages') || 'No pages yet'}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('spaces.createFirstPage') || 'Create your first page using the button in the sidebar'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentPages.map((page) => (
                    <Link
                      key={page.id}
                      href={`/spaces/${slug}/pages/${page.id}`}
                      className="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/50 group"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">{page.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(page.updatedAt).toLocaleDateString(locale, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {page.status === 'DRAFT' && (
                            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              DRAFT
                            </span>
                          )}
                        </span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Members sidebar */}
        <div>
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t('spaces.members') || 'Members'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {members && members.length > 0 ? (
                <div className="space-y-2">
                  {members.slice(0, 10).map((member: any) => (
                    <div key={member.id} className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium">
                        {member.user?.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{member.user?.name || 'Unknown'}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{member.role}</p>
                      </div>
                    </div>
                  ))}
                  {members.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{members.length - 10} more
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('spaces.noMembers') || 'No members'}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function flattenPages(pages: any[]): any[] {
  const result: any[] = [];
  for (const page of pages) {
    result.push(page);
    if (page.children) {
      result.push(...flattenPages(page.children));
    }
  }
  return result;
}
