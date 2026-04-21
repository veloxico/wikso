'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell, Plus, Shield, Star, Clock,
  ChevronDown, ChevronRight, FileText, Settings,
  Loader2, FolderOpen, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useSidebarStore, MIN_WIDTH, MAX_WIDTH } from '@/store/sidebarStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useSpaces } from '@/hooks/useSpaces';
import { usePages, useCreatePage } from '@/hooks/usePages';
import { useFavorites } from '@/hooks/useFavorites';
import { useRecentPages } from '@/hooks/useRecentPages';
import { PageTree } from '@/components/features/PageTree';
import { PageTemplatesDialog } from '@/components/features/PageTemplates';
import { NotificationBell } from '@/components/features/NotificationBell';
import { UserMenu } from '@/components/features/UserMenu';
import { WiksoLogo } from '@/components/ui/WiksoLogo';
import { Button } from '@/components/ui/button';
import type { Space } from '@/types';

/* ─── Resize handle ────────────────────────────────────────────────── */

function ResizeHandle({ onResize }: { onResize: (width: number) => void }) {
  const handleRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      onResize(e.clientX);
    };
    const onMouseUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [onResize]);

  return (
    <div
      ref={handleRef}
      className="group/resize absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-20 flex items-center justify-center"
      onMouseDown={(e) => {
        e.preventDefault();
        dragging.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }}
    >
      <div className="h-8 w-0.5 rounded-full bg-transparent group-hover/resize:bg-primary/40 group-active/resize:bg-primary/60 transition-colors duration-150" />
    </div>
  );
}

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
          'group relative flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-all duration-150 cursor-pointer',
          isCurrentSpace
            ? 'bg-[var(--sidebar-item-active-bg)] text-sidebar-accent-foreground font-medium'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground',
        )}
        onClick={onToggle}
      >
        {/* Active indicator bar */}
        {isCurrentSpace && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[var(--sidebar-item-active-border)]" />
        )}
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40 transition-transform duration-150',
            isExpanded && 'rotate-90',
          )}
        />
        <div
          className={cn(
            'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md text-[10px] font-bold transition-colors',
            isCurrentSpace
              ? 'bg-primary text-primary-foreground'
              : 'bg-sidebar-foreground/8 text-sidebar-foreground/60',
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

        {/* Settings gear – visible on hover */}
        <Link
          href={`/spaces/${space.slug}/settings`}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 p-0.5 rounded-md opacity-0 group-hover:opacity-100 text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-all duration-150"
        >
          <Settings className="h-3 w-3" />
        </Link>
      </div>

      {/* Expanded content: actions + page tree */}
      {isExpanded && (
        <div className="pl-2">
          {/* New Page (opens template picker) */}
          <div className="flex items-center py-0.5 px-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 flex-1 justify-start gap-1.5 text-xs text-muted-foreground/70 hover:text-muted-foreground px-2"
              onClick={() => setShowTemplates(true)}
              disabled={createPage.isPending}
            >
              {createPage.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              {t('pages.newPage')}
            </Button>
          </div>

          {/* Page tree */}
          <div className="pb-1">
            {isLoading && (
              <div className="space-y-1.5 p-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-4 animate-pulse rounded bg-muted" />
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

/* ─── Section header ───────────────────────────────────────────────── */

function SectionHeader({
  icon: Icon,
  label,
  isOpen,
  onToggle,
}: {
  icon: React.ElementType;
  label: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 w-full px-1 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors"
    >
      <Icon className="h-3 w-3" />
      {label}
      <ChevronRight
        className={cn(
          'ml-auto h-3 w-3 transition-transform duration-150',
          isOpen && 'rotate-90',
        )}
      />
    </button>
  );
}

/* ─── UnifiedSidebar ────────────────────────────────────────────────── */

export function UnifiedSidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const { collapsed, toggle, hydrate, width, setWidth } = useSidebarStore();
  const { data: spaces, isLoading: spacesLoading } = useSpaces();

  // Hydrate sidebar collapsed state from localStorage on mount
  useEffect(() => { hydrate(); }, [hydrate]);
  const { data: favorites } = useFavorites();
  const { data: recentPages } = useRecentPages();

  const [showFavorites, setShowFavorites] = useState(true);
  const [showRecent, setShowRecent] = useState(true);

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

  const handleResize = useCallback((x: number) => {
    setWidth(x);
  }, [setWidth]);

  /* ── Collapsed (icon-only) sidebar ── */
  if (collapsed) {
    return (
      <aside className="flex h-screen w-14 flex-col bg-sidebar text-sidebar-foreground transition-all duration-200"
        style={{ boxShadow: 'var(--sidebar-shadow)' }}
      >
        {/* Logo */}
        <div className="flex items-center justify-center py-3.5">
          <Link href="/spaces">
            <WiksoLogo showText={false} className="h-7 w-7" />
          </Link>
        </div>

        {/* Expand button */}
        <div className="flex justify-center py-1.5">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/50" onClick={toggle} title={t('sidebar.expand') || 'Expand sidebar'}>
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        </div>

        {/* Divider */}
        <div className="mx-2.5 h-px bg-sidebar-foreground/8" />

        {/* Quick nav icons */}
        <div className="flex flex-col items-center gap-0.5 py-2">
          {[
            { href: '/notifications', icon: Bell, label: t('sidebar.notifications') },
            { href: '/profile', icon: Settings, label: t('sidebar.profile') },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            const isBell = item.href === '/notifications';
            return (
              <Link key={item.href} href={item.href} title={item.label}>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
                    isActive && 'bg-[var(--sidebar-item-active-bg)] text-sidebar-accent-foreground',
                  )}
                >
                  {isBell ? (
                    <NotificationBell iconClassName="h-4 w-4" variant="corner" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </Button>
              </Link>
            );
          })}
        </div>

        {/* Divider */}
        <div className="mx-2.5 h-px bg-sidebar-foreground/8" />

        {/* Space icons */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center gap-1 py-2">
          {spaces?.map((space) => (
            <Link
              key={space.id}
              href={`/spaces/${space.slug}`}
              title={space.name}
              className={cn(
                'relative flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold transition-all duration-150',
                space.slug === currentSlug
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                  : 'bg-sidebar-foreground/8 text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
              )}
            >
              {space.name.charAt(0).toUpperCase()}
            </Link>
          ))}
          <Link href="/spaces/new" title={t('sidebar.newSpace')}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/30 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground/60 transition-all duration-150 border border-dashed border-sidebar-foreground/15">
              <Plus className="h-3.5 w-3.5" />
            </div>
          </Link>
        </div>

        {/* Admin */}
        {user?.role === 'ADMIN' && (
          <div className="flex justify-center py-1.5">
            <Link href="/admin" title={t('sidebar.admin')}>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground',
                  pathname.startsWith('/admin') && 'bg-[var(--sidebar-item-active-bg)] text-sidebar-accent-foreground',
                )}
              >
                <Shield className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}

        {/* Divider */}
        <div className="mx-2.5 h-px bg-sidebar-foreground/8" />

        {/* User avatar */}
        <div className="flex justify-center py-3">
          <UserMenu avatarSize="h-7 w-7" showName={false} />
        </div>
      </aside>
    );
  }

  /* ── Expanded (full) sidebar ── */
  return (
    <aside
      className="relative flex h-screen flex-col bg-sidebar text-sidebar-foreground shrink-0"
      style={{
        width: `${width}px`,
        minWidth: `${MIN_WIDTH}px`,
        maxWidth: `${MAX_WIDTH}px`,
        boxShadow: 'var(--sidebar-shadow)',
      }}
    >
      {/* Resize handle */}
      <ResizeHandle onResize={handleResize} />

      {/* ── Logo + collapse toggle ── */}
      <div className="flex items-center justify-between px-4 py-3.5">
        <Link href="/spaces" className="flex items-center gap-2.5">
          <WiksoLogo showText={false} className="h-7 w-7" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Wikso</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-sidebar-foreground/30 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
          onClick={toggle}
          title={t('sidebar.collapse') || 'Collapse sidebar'}
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Quick nav icons ── */}
      <div className="flex items-center gap-0.5 px-3 pb-2">
        {[
          { href: '/notifications', icon: Bell, label: t('sidebar.notifications') },
          { href: '/profile', icon: Settings, label: t('sidebar.profile') },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          const isBell = item.href === '/notifications';
          return (
            <Link key={item.href} href={item.href} title={item.label}>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
                  isActive && 'bg-[var(--sidebar-item-active-bg)] text-sidebar-accent-foreground',
                )}
              >
                {isBell ? (
                  <NotificationBell iconClassName="h-4 w-4" variant="corner" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </Button>
            </Link>
          );
        })}
      </div>

      {/* Divider */}
      <div className="mx-3 h-px bg-sidebar-foreground/8" />

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">
        {/* Spaces section header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/40">
            {t('sidebar.spaces')}
          </span>
          <Link href="/spaces/new">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-sidebar-foreground/30 hover:text-sidebar-foreground/60 hover:bg-sidebar-accent/50"
              title={t('sidebar.newSpace')}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {/* Spaces tree */}
        <div className="px-2 pb-2">
          {spacesLoading && (
            <div className="space-y-2 p-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-6 animate-pulse rounded-lg bg-muted/50" />
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
            <div className="px-3 py-6 text-center">
              <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground/60">{t('spaces.noSpaces') || 'No spaces yet'}</p>
              <Link href="/spaces/new">
                <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  {t('sidebar.newSpace')}
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* ── Favorites ── */}
        {favorites && favorites.length > 0 && (
          <div className="px-3 pt-1">
            <div className="mx-0 h-px bg-sidebar-foreground/8 mb-1" />
            <SectionHeader
              icon={Star}
              label={t('sidebar.favorites') || 'Favorites'}
              isOpen={showFavorites}
              onToggle={() => setShowFavorites(!showFavorites)}
            />
            {showFavorites && (
              <div className="space-y-0.5">
                {favorites.slice(0, 8).map((fav) => {
                  const isActive = pathname.includes(fav.page.id);
                  return (
                    <Link
                      key={fav.id}
                      href={`/spaces/${fav.page.space.slug}/pages/${fav.page.id}`}
                      className={cn(
                        'relative flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-all duration-150',
                        isActive
                          ? 'bg-[var(--sidebar-item-active-bg)] text-sidebar-accent-foreground font-medium'
                          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground',
                      )}
                      title={`${fav.page.title} — ${fav.page.space.name}`}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-full bg-[var(--sidebar-item-active-border)]" />
                      )}
                      <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{fav.page.title}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Recent pages ── */}
        {recentPages && recentPages.length > 0 && (
          <div className="px-3 pt-1">
            <div className="mx-0 h-px bg-sidebar-foreground/8 mb-1" />
            <SectionHeader
              icon={Clock}
              label={t('sidebar.recent') || 'Recent'}
              isOpen={showRecent}
              onToggle={() => setShowRecent(!showRecent)}
            />
            {showRecent && (
              <div className="space-y-0.5">
                {recentPages.slice(0, 6).map((item) => {
                  const isActive = pathname.includes(item.page.id);
                  return (
                    <Link
                      key={item.id}
                      href={`/spaces/${item.page.space.slug}/pages/${item.page.id}`}
                      className={cn(
                        'relative flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-all duration-150',
                        isActive
                          ? 'bg-[var(--sidebar-item-active-bg)] text-sidebar-accent-foreground font-medium'
                          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground',
                      )}
                      title={`${item.page.title} — ${item.page.space.name}`}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-full bg-[var(--sidebar-item-active-border)]" />
                      )}
                      <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{item.page.title}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Admin link ── */}
      {user?.role === 'ADMIN' && (
        <div className="px-3 pt-1 pb-1">
          <div className="mx-0 h-px bg-sidebar-foreground/8 mb-1.5" />
          <Link
            href="/admin"
            className={cn(
              'relative flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-all duration-150',
              pathname.startsWith('/admin')
                ? 'bg-[var(--sidebar-item-active-bg)] text-sidebar-accent-foreground font-medium'
                : 'text-sidebar-foreground/50 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground',
            )}
          >
            {pathname.startsWith('/admin') && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-full bg-[var(--sidebar-item-active-border)]" />
            )}
            <Shield className="h-3.5 w-3.5" />
            {t('sidebar.admin')}
          </Link>
        </div>
      )}

      {/* ── User menu ── */}
      <div className="px-3 pb-3 pt-1">
        <div className="mx-0 h-px bg-sidebar-foreground/8 mb-2.5" />
        <UserMenu avatarSize="h-7 w-7" showName />
      </div>
    </aside>
  );
}
