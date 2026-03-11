'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search, Bell, Plus, Shield, Star, Clock,
  ChevronDown, ChevronRight, FileText, Settings,
  Loader2, FolderOpen, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useSidebarStore } from '@/store/sidebarStore';
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
import { Button } from '@/components/ui/button';
import type { Space } from '@/types';

/* ─── SpaceTreeNode ─────────────────────────────────────────────────── */

interface SpaceTreeNodeProps {
  space: Space;
  isExpanded: boolean;
  onToggle: () => void;
  isCurrentSpace: boolean;
}

function SpaceTreeNode({ space, isExpanded, onToggle, isCurrentSpace }: SpaceTreeNodeProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [showTemplates, setShowTemplates] = useState(false);

  // Lazy-load pages only when expanded
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

  const handleCreateChildPage = useCallback((parentId: string) => {
    handleNewPage(undefined, parentId);
  }, [handleNewPage]);

  const handleTemplateSelect = useCallback((content: object) => {
    handleNewPage(content);
  }, [handleNewPage]);

  return (
    <div>
      {/* Space row */}
      <div
        className={cn(
          'group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer',
          isCurrentSpace
            ? 'bg-sidebar-accent/70 text-sidebar-accent-foreground font-medium'
            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground',
        )}
        onClick={onToggle}
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform duration-150',
            isExpanded && 'rotate-90',
          )}
        />
        <div
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold',
            isCurrentSpace
              ? 'bg-primary text-primary-foreground'
              : 'bg-sidebar-foreground/10 text-sidebar-foreground/70',
          )}
        >
          {space.name.charAt(0).toUpperCase()}
        </div>
        <Link
          href={`/spaces/${space.slug}`}
          className="flex-1 truncate"
          onClick={(e) => e.stopPropagation()}
        >
          {space.name}
        </Link>

        {/* Settings gear – visible on hover or when expanded */}
        <Link
          href={`/spaces/${space.slug}/settings`}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 text-sidebar-foreground/50 hover:text-sidebar-foreground transition-opacity"
        >
          <Settings className="h-3 w-3" />
        </Link>
      </div>

      {/* Expanded content: actions + page tree */}
      {isExpanded && (
        <div className="ml-3 border-l border-border/50 pl-2">
          {/* New Page / Template buttons */}
          <div className="flex items-center gap-1 py-1 px-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 flex-1 justify-start gap-1.5 text-xs text-muted-foreground px-2"
              onClick={() => handleNewPage()}
              disabled={createPage.isPending}
            >
              {createPage.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              {t('pages.newPage')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 justify-start gap-1.5 text-xs text-muted-foreground px-2"
              onClick={() => setShowTemplates(true)}
            >
              <FileText className="h-3 w-3" />
            </Button>
          </div>

          {/* Page tree */}
          <div className="pb-1">
            {isLoading && (
              <div className="space-y-1.5 p-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-5 animate-pulse rounded bg-muted" />
                ))}
              </div>
            )}
            {pages && <PageTree pages={pages} slug={space.slug} onCreateChildPage={handleCreateChildPage} />}
          </div>
        </div>
      )}

      {/* Page Templates Dialog */}
      {showTemplates && (
        <PageTemplatesDialog
          open={showTemplates}
          onOpenChange={setShowTemplates}
          onSelect={handleTemplateSelect}
        />
      )}
    </div>
  );
}

/* ─── UnifiedSidebar ────────────────────────────────────────────────── */

export function UnifiedSidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const { collapsed, toggle, hydrate } = useSidebarStore();
  const { data: spaces, isLoading: spacesLoading } = useSpaces();

  // Hydrate sidebar collapsed state from localStorage on mount
  useEffect(() => { hydrate(); }, [hydrate]);
  const { data: favorites } = useFavorites();
  const { data: recentPages } = useRecentPages();

  const [showFavorites, setShowFavorites] = useState(true);
  const [showRecent, setShowRecent] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  // Extract current space slug from URL
  const currentSlugMatch = pathname.match(/^\/spaces\/([^/]+)/);
  const currentSlug = currentSlugMatch?.[1] || null;

  // Track which spaces are expanded (Set of slugs)
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(
    () => new Set(currentSlug ? [currentSlug] : []),
  );

  // Auto-expand when navigating to a new space
  useEffect(() => {
    if (currentSlug && !expandedSlugs.has(currentSlug)) {
      setExpandedSlugs((prev) => new Set([...prev, currentSlug]));
    }
  }, [currentSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSpace = useCallback((slug: string) => {
    setExpandedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  /* ── Collapsed (icon-only) sidebar ── */
  if (collapsed) {
    return (
    <>
      <aside className="flex h-screen w-14 flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-200">
        {/* Logo */}
        <div className="flex items-center justify-center border-b border-border py-3">
          <Link href="/spaces">
            <WiksoLogo showText={false} className="h-7 w-7" />
          </Link>
        </div>

        {/* Expand button */}
        <div className="flex justify-center py-2 border-b border-border">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggle} title={t('sidebar.expand') || 'Expand sidebar'}>
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick nav icons */}
        <div className="flex flex-col items-center gap-1 py-2 border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={t('sidebar.search')}
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
          </Button>
          {[
            { href: '/notifications', icon: Bell, label: t('sidebar.notifications') },
            { href: '/profile', icon: Settings, label: t('sidebar.profile') },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} title={item.label}>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-8 w-8', isActive && 'bg-sidebar-accent text-sidebar-accent-foreground')}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              </Link>
            );
          })}
        </div>

        {/* Space icons */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center gap-1 py-2">
          {spaces?.map((space) => (
            <Link
              key={space.id}
              href={`/spaces/${space.slug}`}
              title={space.name}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md text-[11px] font-bold transition-colors',
                space.slug === currentSlug
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-sidebar-foreground/10 text-sidebar-foreground/70 hover:bg-sidebar-accent/50',
              )}
            >
              {space.name.charAt(0).toUpperCase()}
            </Link>
          ))}
          <Link href="/spaces/new" title={t('sidebar.newSpace')}>
            <div className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/40 hover:bg-sidebar-accent/40 transition-colors">
              <Plus className="h-4 w-4" />
            </div>
          </Link>
        </div>

        {/* Admin */}
        {user?.role === 'ADMIN' && (
          <div className="flex justify-center border-t border-border py-1">
            <Link href="/admin" title={t('sidebar.admin')}>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8', pathname.startsWith('/admin') && 'bg-sidebar-accent text-sidebar-accent-foreground')}
              >
                <Shield className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}

        {/* User avatar */}
        <div className="border-t border-border flex justify-center py-3">
          <UserMenu avatarSize="h-7 w-7" showName={false} />
        </div>
      </aside>
      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
    );
  }

  /* ── Expanded (full) sidebar ── */
  return (
    <>
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-200">
      {/* ── Logo + collapse toggle ── */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link href="/spaces" className="flex items-center gap-2">
          <WiksoLogo showText={false} className="h-7 w-7" />
          <span className="text-base font-semibold">Wikso</span>
        </Link>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground" onClick={toggle} title={t('sidebar.collapse') || 'Collapse sidebar'}>
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Quick nav ── */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title={t('sidebar.search')}
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-4 w-4" />
        </Button>
        {[
          { href: '/notifications', icon: Bell, label: t('sidebar.notifications') },
          { href: '/profile', icon: Settings, label: t('sidebar.profile') },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} title={item.label}>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-8 w-8',
                  isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
              </Button>
            </Link>
          );
        })}
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">
        {/* Spaces section header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            {t('sidebar.spaces')}
          </span>
          <Link href="/spaces/new">
            <Button variant="ghost" size="icon" className="h-5 w-5" title={t('sidebar.newSpace')}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {/* Spaces tree */}
        <div className="px-2 pb-2">
          {spacesLoading && (
            <div className="space-y-2 p-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-muted" />
              ))}
            </div>
          )}
          {spaces?.map((space) => (
            <SpaceTreeNode
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

        {/* ── Favorites ── */}
        {favorites && favorites.length > 0 && (
          <div className="px-3 pt-1 border-t border-border">
            <button
              onClick={() => setShowFavorites(!showFavorites)}
              className="flex items-center gap-2 w-full px-0 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/70 transition-colors"
            >
              {showFavorites ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <Star className="h-3 w-3" />
              {t('sidebar.favorites') || 'Favorites'}
            </button>
            {showFavorites && (
              <div className="space-y-0.5 mt-0.5">
                {favorites.slice(0, 8).map((fav) => (
                  <Link
                    key={fav.id}
                    href={`/spaces/${fav.page.space.slug}/pages/${fav.page.id}`}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                      pathname.includes(fav.page.id)
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                    )}
                    title={`${fav.page.title} — ${fav.page.space.name}`}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{fav.page.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Recent pages ── */}
        {recentPages && recentPages.length > 0 && (
          <div className="px-3 pt-1 border-t border-border">
            <button
              onClick={() => setShowRecent(!showRecent)}
              className="flex items-center gap-2 w-full px-0 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/70 transition-colors"
            >
              {showRecent ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <Clock className="h-3 w-3" />
              {t('sidebar.recent') || 'Recent'}
            </button>
            {showRecent && (
              <div className="space-y-0.5 mt-0.5">
                {recentPages.slice(0, 6).map((item) => (
                  <Link
                    key={item.id}
                    href={`/spaces/${item.page.space.slug}/pages/${item.page.id}`}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                      pathname.includes(item.page.id)
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                    )}
                    title={`${item.page.title} — ${item.page.space.name}`}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.page.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Admin link ── */}
      {user?.role === 'ADMIN' && (
        <div className="px-3 pb-1 border-t border-border pt-1">
          <Link
            href="/admin"
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
              pathname.startsWith('/admin')
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
            )}
          >
            <Shield className="h-3.5 w-3.5" />
            {t('sidebar.admin')}
          </Link>
        </div>
      )}

      {/* ── User menu ── */}
      <div className="border-t border-border p-3">
        <UserMenu avatarSize="h-7 w-7" showName />
      </div>
    </aside>
    <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
