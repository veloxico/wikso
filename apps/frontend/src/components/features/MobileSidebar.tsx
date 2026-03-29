'use client';

import { useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import {
  Search, Bell, Shield, Star, Clock, Plus,
  ChevronDown, ChevronRight, FileText, Settings,
  Loader2, FolderOpen, ArrowLeft,
  Users, UsersRound, Trash2, ScrollText, Key, Mail,
  Webhook, Activity, Upload, Bot,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useSpaces } from '@/hooks/useSpaces';
import { usePages, useCreatePage } from '@/hooks/usePages';
import { useFavorites } from '@/hooks/useFavorites';
import { useRecentPages } from '@/hooks/useRecentPages';
import { PageTree } from '@/components/features/PageTree';
import { GlobalSearchDialog } from '@/components/features/GlobalSearchDialog';
import { PageTemplatesDialog } from '@/components/features/PageTemplates';
import { UserMenu } from '@/components/features/UserMenu';
import { WiksoLogo } from '@/components/ui/WiksoLogo';
import type { Space } from '@/types';

/* ─── Mobile space tree node ─────────────────────────────────────── */

function MobileSpaceNode({ space, isExpanded, onToggle, isCurrentSpace }: {
  space: Space;
  isExpanded: boolean;
  onToggle: () => void;
  isCurrentSpace: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [showTemplates, setShowTemplates] = useState(false);
  const { data: pages, isLoading } = usePages(isExpanded ? space.slug : '');
  const createPage = useCreatePage(space.slug);

  const handleNewPage = useCallback(async (contentJson?: object, parentId?: string) => {
    try {
      const newPage = await createPage.mutateAsync({
        title: t('pages.untitled'),
        ...(parentId ? { parentId } : {}),
        ...(contentJson ? { contentJson: contentJson as Record<string, unknown> } : {}),
      });
      router.push(`/spaces/${space.slug}/pages/${newPage.id}`);
    } catch {
      toast.error(t('pages.failedToCreate'));
    }
  }, [createPage, router, space.slug, t]);

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer',
          isCurrentSpace
            ? 'bg-sidebar-accent/70 text-sidebar-accent-foreground font-medium'
            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/40',
        )}
        onClick={onToggle}
      >
        <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform duration-150', isExpanded && 'rotate-90')} />
        <div className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold',
          isCurrentSpace ? 'bg-primary text-primary-foreground' : 'bg-sidebar-foreground/10 text-sidebar-foreground/70',
        )}>
          {space.name.charAt(0).toUpperCase()}
        </div>
        <Link href={`/spaces/${space.slug}`} className="flex-1 truncate" onClick={(e) => e.stopPropagation()}>
          {space.name}
        </Link>
      </div>
      {isExpanded && (
        <div className="pl-2">
          <div className="flex items-center py-0.5 px-0.5">
            <Button variant="ghost" size="sm" className="h-6 flex-1 justify-start gap-1.5 text-xs text-muted-foreground px-2"
              onClick={() => setShowTemplates(true)} disabled={createPage.isPending}>
              {createPage.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              {t('pages.newPage')}
            </Button>
          </div>
          <div className="pb-1">
            {isLoading && (
              <div className="space-y-1.5 p-2">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-4 animate-pulse rounded bg-muted" />)}
              </div>
            )}
            {pages && <PageTree pages={pages} slug={space.slug} onCreateChildPage={(parentId) => handleNewPage(undefined, parentId)} />}
          </div>
        </div>
      )}
      {showTemplates && (
        <PageTemplatesDialog open={showTemplates} onOpenChange={setShowTemplates} onSelect={(content) => handleNewPage(content)} />
      )}
    </div>
  );
}

/* ─── Mobile sidebar content (admin) ─────────────────────────────── */

function MobileAdminContent() {
  const pathname = usePathname();
  const { t } = useTranslation();

  const adminNav = [
    { href: '/admin/general', labelKey: 'admin.nav.general', icon: Settings },
    { href: '/admin/security', labelKey: 'admin.nav.securityAccess', icon: Shield },
    { href: '/admin/users', labelKey: 'admin.nav.users', icon: Users },
    { href: '/admin/groups', labelKey: 'admin.nav.groups', icon: UsersRound },
    { href: '/admin/spaces', labelKey: 'admin.nav.spaces', icon: FolderOpen },
    { href: '/admin/trash', labelKey: 'admin.nav.trash', icon: Trash2 },
    { href: '/admin/audit-log', labelKey: 'admin.nav.auditLog', icon: ScrollText },
    { href: '/admin/auth', labelKey: 'admin.nav.authProviders', icon: Key },
    { href: '/admin/email', labelKey: 'admin.nav.email', icon: Mail },
    { href: '/admin/webhooks', labelKey: 'admin.nav.webhooks', icon: Webhook },
    { href: '/admin/health', labelKey: 'admin.nav.systemHealth', icon: Activity },
    { href: '/admin/ai', labelKey: 'admin.nav.ai', icon: Bot },
    { href: '/admin/import', labelKey: 'admin.nav.import', icon: Upload, badge: 'Beta' },
  ];

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 border-b border-border px-4 py-4">
        <Link href="/spaces" className="flex items-center gap-2">
          <WiksoLogo showText={false} className="h-7 w-7" />
          <span className="text-base font-semibold">Wikso</span>
        </Link>
      </div>
      <div className="px-3 py-2 border-b border-border">
        <Link href="/spaces" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {t('admin.backToSpaces') || 'Back to Spaces'}
        </Link>
      </div>
      <div className="px-6 pt-4 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">{t('admin.title')}</h2>
      </div>
      <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
        {adminNav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href} className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50',
            )}>
              <Icon className="h-4 w-4" />
              {t(item.labelKey)}
              {(item as any).badge && (
                <span className="ml-auto rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                  {(item as any).badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <UserMenu avatarSize="h-7 w-7" showName />
      </div>
    </div>
  );
}

/* ─── Mobile sidebar content (main) ──────────────────────────────── */

function MobileMainContent() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const { data: spaces, isLoading: spacesLoading } = useSpaces();
  const { data: favorites } = useFavorites();
  const { data: recentPages } = useRecentPages();
  const [searchOpen, setSearchOpen] = useState(false);
  const [showFavorites, setShowFavorites] = useState(true);
  const [showRecent, setShowRecent] = useState(true);

  const currentSlugMatch = pathname.match(/^\/spaces\/([^/]+)/);
  const currentSlug = currentSlugMatch?.[1] || null;

  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(
    () => new Set(currentSlug ? [currentSlug] : []),
  );

  const toggleSpace = useCallback((slug: string) => {
    setExpandedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  return (
    <>
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Link href="/spaces" className="flex items-center gap-2">
          <WiksoLogo showText={false} className="h-7 w-7" />
          <span className="text-base font-semibold">Wikso</span>
        </Link>
      </div>

      {/* Quick nav */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
        <Button variant="ghost" size="icon" className="h-8 w-8" title={t('sidebar.search')} onClick={() => setSearchOpen(true)}>
          <Search className="h-4 w-4" />
        </Button>
        <Link href="/notifications" title={t('sidebar.notifications')}>
          <Button variant="ghost" size="icon" className={cn('h-8 w-8', pathname.startsWith('/notifications') && 'bg-sidebar-accent text-sidebar-accent-foreground')}>
            <Bell className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/profile" title={t('sidebar.profile')}>
          <Button variant="ghost" size="icon" className={cn('h-8 w-8', pathname.startsWith('/profile') && 'bg-sidebar-accent text-sidebar-accent-foreground')}>
            <Settings className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Spaces */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">{t('sidebar.spaces')}</span>
          <Link href="/spaces/new">
            <Button variant="ghost" size="icon" className="h-5 w-5" title={t('sidebar.newSpace')}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
        <div className="px-2 pb-2">
          {spacesLoading && (
            <div className="space-y-2 p-2">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-6 animate-pulse rounded bg-muted" />)}
            </div>
          )}
          {spaces?.map((space) => (
            <MobileSpaceNode
              key={space.id}
              space={space}
              isExpanded={expandedSlugs.has(space.slug)}
              onToggle={() => toggleSpace(space.slug)}
              isCurrentSpace={space.slug === currentSlug}
            />
          ))}
          {spaces && spaces.length === 0 && (
            <div className="px-3 py-4 text-center">
              <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">{t('spaces.noSpaces') || 'No spaces yet'}</p>
              <Link href="/spaces/new">
                <Button variant="outline" size="sm" className="mt-2 gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  {t('sidebar.newSpace')}
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Favorites */}
        {favorites && favorites.length > 0 && (
          <div className="px-3 pt-1 border-t border-border">
            <button onClick={() => setShowFavorites(!showFavorites)}
              className="flex items-center gap-2 w-full px-0 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/70 transition-colors">
              {showFavorites ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <Star className="h-3 w-3" />
              {t('sidebar.favorites') || 'Favorites'}
            </button>
            {showFavorites && (
              <div className="space-y-0.5 mt-0.5">
                {favorites.slice(0, 8).map((fav) => (
                  <Link key={fav.id} href={`/spaces/${fav.page.space.slug}/pages/${fav.page.id}`}
                    className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                      pathname.includes(fav.page.id) ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50',
                    )} title={`${fav.page.title} — ${fav.page.space.name}`}>
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{fav.page.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent */}
        {recentPages && recentPages.length > 0 && (
          <div className="px-3 pt-1 border-t border-border">
            <button onClick={() => setShowRecent(!showRecent)}
              className="flex items-center gap-2 w-full px-0 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/70 transition-colors">
              {showRecent ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <Clock className="h-3 w-3" />
              {t('sidebar.recent') || 'Recent'}
            </button>
            {showRecent && (
              <div className="space-y-0.5 mt-0.5">
                {recentPages.slice(0, 6).map((item) => (
                  <Link key={item.id} href={`/spaces/${item.page.space.slug}/pages/${item.page.id}`}
                    className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                      pathname.includes(item.page.id) ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50',
                    )} title={`${item.page.title} — ${item.page.space.name}`}>
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.page.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Admin link */}
      {user?.role === 'ADMIN' && (
        <div className="px-3 pb-1 border-t border-border pt-1">
          <Link href="/admin" className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
            pathname.startsWith('/admin') ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50',
          )}>
            <Shield className="h-3.5 w-3.5" />
            {t('sidebar.admin')}
          </Link>
        </div>
      )}

      {/* User menu */}
      <div className="border-t border-border p-3">
        <UserMenu avatarSize="h-7 w-7" showName />
      </div>
    </div>
    <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}

/* ─── MobileSidebar ──────────────────────────────────────────────── */

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isAdminContext = pathname.startsWith('/admin');

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href) {
      setOpen(false);
    }
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden fixed top-3 left-3 z-40">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0" showCloseButton={false}>
        <div onClick={handleClick} className="h-full">
          {isAdminContext ? <MobileAdminContent /> : <MobileMainContent />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
