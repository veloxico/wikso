'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Save, History, MessageSquare, Star, Pencil, Eye, ChevronDown, ChevronRight, Trash2, MoreHorizontal, Copy, FilePlus, MoveHorizontal, ScanEye, Share2, BarChart3 } from 'lucide-react';
import { usePage, useUpdatePage, useDuplicatePage, useCreatePage, usePageAncestors } from '@/hooks/usePages';
import { useSpace } from '@/hooks/useSpaces';
import { useTranslation } from '@/hooks/useTranslation';
import { useCheckFavorite, useToggleFavorite } from '@/hooks/useFavorites';
import { useRecordPageVisit } from '@/hooks/useRecentPages';
import { usePagePermissions } from '@/hooks/usePagePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DeletePageDialog } from '@/components/features/DeletePageDialog';
import { MovePageDialog } from '@/components/features/MovePageDialog';
import { VersionHistoryDialog } from '@/components/features/VersionHistoryDialog';
import { ShareDialog } from '@/components/features/ShareDialog';
import { PageStatsDialog } from '@/components/features/PageStatsDialog';
import { WatchButton } from '@/components/features/WatchButton';
import { BacklinksPanel } from '@/components/features/BacklinksPanel';
import { Comments } from '@/components/features/Comments';
import { Breadcrumbs } from '@/components/features/Breadcrumbs';
import { PageExport } from '@/components/features/PageExport';
import { KeyboardShortcutsDialog } from '@/components/features/KeyboardShortcuts';
import { TagManager } from '@/components/features/TagManager';
import { ReadingProgress } from '@/components/features/ReadingProgress';
import { PageOutline } from '@/components/features/PageOutline';
import { HeadingAnchors } from '@/components/features/HeadingAnchors';
import { ReadingMeta } from '@/components/features/ReadingMeta';
import { ReadingModeToggle, disableReadingMode } from '@/components/features/ReadingModeToggle';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { bcp47Locale } from '@/lib/locale';

// Dynamic imports for client-only components
const CollaborativeEditor = dynamic(
  () => import('@/components/features/CollaborativeEditor').then((m) => m.CollaborativeEditor),
  { ssr: false }
);

export default function PageEditorPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const pageId = params.pageId as string;

  const { data: page, isLoading, isPlaceholderData } = usePage(slug, pageId);
  const { data: space } = useSpace(slug);
  const { data: ancestors } = usePageAncestors(slug, pageId);
  const updatePage = useUpdatePage(slug, pageId);
  const createChildPage = useCreatePage(slug);
  const { t, locale } = useTranslation();
  const [title, setTitle] = useState('');
  const [titleInitialized, setTitleInitialized] = useState(false);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // View / Edit / Preview mode — default is view
  const [mode, setMode] = useState<'view' | 'edit' | 'preview'>('view');
  const { canEdit } = usePagePermissions(slug, pageId);
  const isEditing = mode === 'edit' && canEdit;
  const isPreviewing = mode === 'preview';

  // Reading mode and edit mode are mutually exclusive — entering edit
  // while reading is on hides the toolbar (it's tagged `data-chrome`).
  // Clear the reading flag whenever we slip into edit. Preview keeps
  // reading mode because preview is a reading surface.
  useEffect(() => {
    if (isEditing) disableReadingMode();
  }, [isEditing]);

  // Dialogs
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);

  // Favorites
  const { data: favoriteStatus } = useCheckFavorite(pageId);
  const toggleFavorite = useToggleFavorite();

  // Duplicate
  const duplicatePage = useDuplicatePage(slug);

  // Record page visit for recent pages
  const recordVisit = useRecordPageVisit();
  useEffect(() => {
    if (pageId) {
      recordVisit.mutate(pageId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  // Reset title state when navigating to a different page
  const prevPageIdRef = useRef(pageId);
  useEffect(() => {
    if (prevPageIdRef.current !== pageId) {
      prevPageIdRef.current = pageId;
      setTitleInitialized(false);
      setHasUnsavedChanges(false);
      setMode('view');
    }
  }, [pageId]);

  useEffect(() => {
    if (page && !isPlaceholderData && !titleInitialized) {
      setTitle(page.title);
      setTitleInitialized(true);
    }
  }, [page, isPlaceholderData, titleInitialized]);

  const handleSaveTitle = useCallback(() => {
    if (title && title !== page?.title) {
      updatePage.mutate(
        { title },
        {
          onSuccess: () => toast.success(t('pages.titleSaved')),
          onError: () => toast.error(t('pages.titleSaveFailed')),
        },
      );
    }
  }, [title, page, updatePage, t]);

  /** Save page (title + content snapshot) and switch to view mode. */
  const handleSave = useCallback(() => {
    const payload: Record<string, unknown> = {};
    if (title && title !== page?.title) payload.title = title;
    // Grab current editor JSON — this also creates a new PageVersion on the backend
    if (editorInstance) {
      payload.contentJson = editorInstance.getJSON();
    }
    if (Object.keys(payload).length === 0) {
      // Nothing changed but user pressed save — just confirm & switch mode
      toast.success(t('pages.pageSaved') || 'Page saved');
      setMode('view');
      setHasUnsavedChanges(false);
      return;
    }
    updatePage.mutate(payload as any, {
      onSuccess: () => {
        toast.success(t('pages.pageSaved') || 'Page saved');
        setMode('view');
        setHasUnsavedChanges(false);
      },
      onError: () => toast.error(t('pages.saveFailed') || 'Failed to save page'),
    });
  }, [title, page, editorInstance, updatePage, t]);

  const handleEditorReady = useCallback((editor: any) => {
    setEditorInstance(editor);
  }, []);

  const handleCreateChildPage = useCallback(async () => {
    try {
      const newPage = await createChildPage.mutateAsync({
        title: t('pages.untitled'),
        parentId: pageId,
      });
      router.push(`/spaces/${slug}/pages/${newPage.id}`);
    } catch {
      toast.error(t('pages.failedToCreate'));
    }
  }, [createChildPage, pageId, slug, router, t]);

  const handleToggleFavorite = useCallback(() => {
    toggleFavorite.mutate(pageId, {
      onSuccess: (data) => {
        toast.success(data.isFavorite ? (t('pages.addedToFavorites') || 'Added to favorites') : (t('pages.removedFromFavorites') || 'Removed from favorites'));
      },
    });
  }, [pageId, toggleFavorite, t]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && (isEditing || isPreviewing)) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges, isEditing, isPreviewing]);

  // Only show skeleton on very first load (no previous data to display).
  // With placeholderData: keepPreviousData, the old page stays visible during navigation.
  if (isLoading && !page) {
    return (
      <div className="mx-auto flex w-full max-w-[912px] flex-col items-center justify-center gap-4 px-6 py-24">
        {/* Ink-drop spinner — radial gradient bleed in the active accent
            instead of a generic muted-gray pulse. The label uses the
            same Caveat hand as the rest of the warm-paper system so
            even the loading state stays in the design language. */}
        <div className="wp-inkbleed" role="status" aria-busy="true" />
        <span className="wp-inkbleed-label">{t('pages.loading') || 'Settling the ink…'}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Reading progress bar — thin indicator pinned to the top of the
          viewport, reflects dashboard scroll state. Hidden on view-mode only? no —
          we keep it in edit mode too: the bar is unobtrusive and helpful for
          long docs either way. */}
      <ReadingProgress />

      {/* Right-rail scroll-spy outline. Auto-hidden below xl, auto-hidden when
          there's fewer than 2 headings (short pages don't need a TOC). */}
      <PageOutline
        className="absolute top-24 right-4 2xl:right-10 z-10"
        label={t('pageOutline.label') || 'On this page'}
      />

      {/* Inject clickable copy-link buttons into every h1..h3. Renders
          nothing — runs a DOM side-effect scoped to the reading
          surface. MutationObserver keeps buttons in sync as the
          editor content changes. */}
      <HeadingAnchors />

      {/* Keyboard Shortcuts Dialog (global, triggered by Ctrl+/) */}
      <KeyboardShortcutsDialog />

      {/* Main content area — warm-paper editorial header. Breadcrumbs
          are kept as a thin line; title steps up into the doc-ribbon
          serif treatment so the reader lands on a recognisable
          "document page" the moment they open it. */}
      <div
        className="mx-auto w-full max-w-[912px] px-3 md:px-6 pt-2 pb-0"
      >
        {/* Row 1: Breadcrumbs — tagged as chrome so print + reading
            mode hide it cleanly. The title and ReadingMeta below are
            content, so they remain unmarked and stay visible. */}
        <div className="flex items-center gap-2 mb-1" data-chrome="topbar">
          <Breadcrumbs
            className="min-w-0 shrink"
            items={[
              { label: space?.name || slug, href: `/spaces/${slug}` },
              ...(ancestors || []).map((a) => ({
                label: a.title,
                href: `/spaces/${slug}/pages/${a.id}`,
              })),
              { label: page?.title || 'Page' },
            ]}
          />
        </div>

        {/* Row 1.5: Editorial dateline — small-caps "WEEKDAY · DATE ·
            UPDATED N AGO" magazine-style. Renders only when we have a
            page (avoids flicker during the placeholder shimmer). The
            dateline lives outside topbar-secondary so it stays in print
            output as part of the document, not chrome. */}
        {page?.updatedAt && (
          <p className="wp-dateline mt-3" aria-label={t('pages.dateline') || 'Document dateline'}>
            <time dateTime={new Date(page.updatedAt).toISOString()}>
              {new Date(page.updatedAt).toLocaleDateString(bcp47Locale(locale), {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </time>
            <span aria-hidden="true">·</span>
            <span className={isEditing ? 'live' : ''}>
              {isEditing
                ? (t('pages.editing') || 'Editing now')
                : `${t('pages.updated') || 'Updated'} ${(() => {
                    const delta = (Date.now() - new Date(page.updatedAt).getTime()) / 1000;
                    // bcp47Locale() — esAR/ptBR are not valid BCP-47 tags
                    // and would crash the entire dateline with RangeError.
                    const rtf = new Intl.RelativeTimeFormat(bcp47Locale(locale), { numeric: 'auto' });
                    if (delta < 60) return rtf.format(-Math.round(delta), 'second');
                    if (delta < 3600) return rtf.format(-Math.round(delta / 60), 'minute');
                    if (delta < 86400) return rtf.format(-Math.round(delta / 3600), 'hour');
                    if (delta < 2592000) return rtf.format(-Math.round(delta / 86400), 'day');
                    return rtf.format(-Math.round(delta / 2592000), 'month');
                  })()}`}
            </span>
          </p>
        )}

        {/* Row 2: Title + star — wp-doc-ribbon layout. We reuse the
            ribbon's serif H1 sizing even in edit mode so switching
            edit↔view doesn't shift the baseline. */}
        <div className="flex items-end gap-3 mb-1 min-w-0 pt-3 pb-3">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (e.target.value !== page?.title) setHasUnsavedChanges(true);
                }}
                onBlur={handleSaveTitle}
                className="h-auto border-none bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                style={{
                  fontFamily: 'var(--body-font)',
                  fontSize: 'clamp(26px, 3.2vw, 40px)',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.15,
                  color: 'var(--ink)',
                }}
                placeholder={t('pages.untitled')}
              />
            ) : (
              <h1
                className="truncate px-0"
                style={{
                  fontFamily: 'var(--body-font)',
                  fontSize: 'clamp(26px, 3.2vw, 40px)',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.15,
                  color: 'var(--ink)',
                  textWrap: 'balance' as React.CSSProperties['textWrap'],
                }}
              >
                {title || page?.title || t('pages.untitled')}
              </h1>
            )}
          </div>
          <button
            onClick={handleToggleFavorite}
            className={cn(
              'shrink-0 p-1 rounded-md transition-colors',
              favoriteStatus?.isFavorite
                ? 'text-yellow-500 hover:text-yellow-600'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={favoriteStatus?.isFavorite ? (t('pages.removeFromFavorites') || 'Remove from favorites') : (t('pages.addToFavorites') || 'Add to favorites')}
          >
            <Star className={cn('h-4 w-4', favoriteStatus?.isFavorite && 'fill-current')} />
          </button>
          {page?.tags && (
            <div className="shrink-0 hidden sm:block">
              <TagManager
                slug={slug}
                pageId={pageId}
                pageTags={(page.tags as any[]).filter((pt: any) => pt.tag).map((pt: any) => ({
                  tagId: pt.tagId,
                  tag: { id: pt.tag.id, name: pt.tag.name },
                }))}
              />
            </div>
          )}
        </div>

        {/* Row 2.5: Reading metadata — reading time, word count, and
            a relative "updated X ago" timestamp. Sits below the title
            as an editorial signal; reads the live editor surface so
            the counts tick as the author types. */}
        <div className="mb-2">
          <ReadingMeta
            updatedAt={page?.updatedAt}
            locale={locale}
            labels={{
              minRead: t('pages.minRead'),
              words: t('pages.words'),
              updated: t('pages.updated'),
            }}
          />
        </div>

        {/* Row 3: Action buttons. Tagged `topbar-secondary` so they
            collapse in reading mode and disappear from print output. */}
        <div className="flex items-center gap-1 mb-1 flex-wrap" data-chrome="topbar-secondary">
          <PageExport editor={editorInstance} pageTitle={title || t('pages.untitled')} />

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-7 text-xs hidden sm:inline-flex"
            onClick={() => setShowVersionHistory(true)}
          >
            <History className="h-3.5 w-3.5" />
            {t('pages.versionHistory')}
          </Button>

          <WatchButton slug={slug} pageId={pageId} />

          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 h-7 text-xs"
              onClick={() => setShowShareDialog(true)}
              title={t('shares.share') || 'Share'}
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('shares.share') || 'Share'}</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-7 text-xs hidden sm:inline-flex"
            onClick={() => setShowStatsDialog(true)}
            title={t('analytics.title') || 'Analytics'}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{t('analytics.short') || 'Stats'}</span>
          </Button>

          {mode === 'view' && canEdit && (
            <Button onClick={() => setMode('edit')} size="sm" className="gap-1.5 h-7 text-xs">
              <Pencil className="h-3.5 w-3.5" />
              {t('pages.edit') || 'Edit'}
            </Button>
          )}
          {isEditing && !isPreviewing && (
            <>
              {/* Autosave / save-state indicator. Uses `.wp-saved`
                  primitive — the state dot is drawn via CSS `::before`
                  (pulsing accent dot when `saving`, red `!` badge when
                  `error`); in the `saved` state the text alone carries
                  the signal, which keeps the strip quiet between
                  transitions. Sits next to the Save button so the user
                  always knows where their work stands without hunting
                  for a modal or toast. */}
              <span
                className="wp-saved"
                data-state={updatePage.isPending ? 'saving' : updatePage.isError ? 'error' : 'saved'}
                aria-live="polite"
              >
                {updatePage.isPending
                  ? (t('pages.saving') || 'Saving…')
                  : updatePage.isError
                    ? (t('pages.saveFailedShort') || 'Not saved')
                    : hasUnsavedChanges
                      ? (t('pages.unsavedChanges') || 'Unsaved changes')
                      : page?.updatedAt
                        ? (
                          <>
                            {t('pages.savedPrefix') || 'Saved'}{' '}
                            <time dateTime={new Date(page.updatedAt).toISOString()}>
                              {new Date(page.updatedAt).toLocaleTimeString(bcp47Locale(locale), {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </time>
                          </>
                        )
                        : (t('pages.autoSave') || 'Autosave on')}
              </span>
              <Button onClick={handleSave} disabled={updatePage.isPending} size="sm" className="gap-1.5 h-7 text-xs">
                <Save className="h-3.5 w-3.5" />
                {updatePage.isPending ? t('common.saving') : t('pages.save')}
              </Button>
              <Button onClick={() => setMode('preview')} size="sm" variant="ghost" className="gap-1.5 h-7 text-xs">
                <Eye className="h-3.5 w-3.5" />
                {t('pages.preview') || 'Preview'}
              </Button>
            </>
          )}
          {isPreviewing && (
            <Button onClick={() => setMode('edit')} size="sm" variant="outline" className="gap-1.5 h-7 text-xs">
              <Pencil className="h-3.5 w-3.5" />
              {t('pages.backToEditing') || 'Back to editing'}
            </Button>
          )}

          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="sm:hidden" onClick={() => setShowVersionHistory(true)}>
                  <History className="h-4 w-4" />
                  {t('pages.versionHistory')}
                </DropdownMenuItem>
                {isEditing && (
                  <>
                    <DropdownMenuItem onClick={() => setMode('preview')}>
                      <ScanEye className="h-4 w-4" />
                      {t('pages.preview') || 'Preview'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={handleCreateChildPage}
                  disabled={createChildPage.isPending}
                >
                  <FilePlus className="h-4 w-4" />
                  {t('pages.createChildPage')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => duplicatePage.mutate(pageId)}
                  disabled={duplicatePage.isPending}
                >
                  <Copy className="h-4 w-4" />
                  {t('pages.duplicate')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowMoveDialog(true)}
                >
                  <MoveHorizontal className="h-4 w-4" />
                  {t('pages.movePage') || 'Move'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('pages.deletePage')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Reading-mode toggle — kept OUTSIDE topbar-secondary so it
            stays reachable while every other action collapses. Floats
            top-right when reading mode is active so it doesn't add
            visual weight to the document chrome. */}
        {mode === 'view' && (
          <div className="reading-toggle-mount fixed right-4 top-3 z-30 sm:static sm:mb-2 sm:flex sm:justify-end">
            <ReadingModeToggle />
          </div>
        )}

        {/* Preview banner */}
        {isPreviewing && (
          <div className="mb-1 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 dark:border-blue-800 dark:bg-blue-950/50">
            <ScanEye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {t('pages.previewMode') || 'Preview mode — this is how the page will look after publishing'}
            </span>
          </div>
        )}
      </div>

      {/* Collaborative Editor — toolbar stretches full width, content centered */}
      <CollaborativeEditor
        pageId={pageId}
        spaceSlug={slug}
        editable={isEditing}
        onEditorReady={handleEditorReady}
        initialContent={page?.contentJson as Record<string, unknown> | null}
        onContentChange={() => setHasUnsavedChanges(true)}
      />

      {/* Backlinks + Comments — centered */}
      <div className="mx-auto w-full max-w-[912px] px-3 md:px-6" data-chrome="comments">
        <BacklinksPanel slug={slug} pageId={pageId} className="mt-6" />

        <div className="mt-4 border-t border-border pt-4">
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex w-full items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            {showComments ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <MessageSquare className="h-4 w-4" />
            {t('comments.title')}
          </button>
          {showComments && (
            <div className="mt-4">
              <Comments pageId={pageId} />
            </div>
          )}
        </div>
      </div>

      {/* Delete Page Dialog */}
      <DeletePageDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        pageId={pageId}
        pageTitle={title || page?.title || ''}
        slug={slug}
        onDeleted={() => router.push(`/spaces/${slug}`)}
      />

      {/* Move Page Dialog */}
      <MovePageDialog
        open={showMoveDialog}
        onOpenChange={setShowMoveDialog}
        pageId={pageId}
        pageTitle={title || page?.title || ''}
        currentParentId={page?.parentId}
        slug={slug}
      />

      {/* Version History Dialog */}
      <VersionHistoryDialog
        open={showVersionHistory}
        onOpenChange={setShowVersionHistory}
        slug={slug}
        pageId={pageId}
        currentContent={page?.contentJson as Record<string, unknown>}
      />

      {/* Share Dialog */}
      <ShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        slug={slug}
        pageId={pageId}
        pageTitle={title || page?.title || ''}
      />

      {/* Page Stats Dialog */}
      <PageStatsDialog
        open={showStatsDialog}
        onOpenChange={setShowStatsDialog}
        slug={slug}
        pageId={pageId}
        pageTitle={title || page?.title || ''}
      />
    </div>
  );
}
