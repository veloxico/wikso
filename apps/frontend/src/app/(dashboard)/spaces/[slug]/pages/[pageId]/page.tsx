'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Save, Clock, History, MessageSquare, Star, Pencil, Eye, ChevronDown, ChevronRight, Trash2, MoreHorizontal, Copy, FilePlus, MoveHorizontal } from 'lucide-react';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DeletePageDialog } from '@/components/features/DeletePageDialog';
import { MovePageDialog } from '@/components/features/MovePageDialog';
import { VersionHistoryDialog } from '@/components/features/VersionHistoryDialog';
import { Comments } from '@/components/features/Comments';
import { Breadcrumbs } from '@/components/features/Breadcrumbs';
import { PageExport } from '@/components/features/PageExport';
import { KeyboardShortcutsDialog } from '@/components/features/KeyboardShortcuts';
import { TagManager } from '@/components/features/TagManager';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Dynamic imports for client-only components
const CollaborativeEditor = dynamic(
  () => import('@/components/features/CollaborativeEditor').then((m) => m.CollaborativeEditor),
  { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-lg bg-muted" /> }
);

const TableOfContents = dynamic(
  () => import('@/components/features/TableOfContents').then((m) => m.TableOfContents),
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

  // View / Edit mode — default is view
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const { canEdit } = usePagePermissions(slug, pageId);
  const isEditing = mode === 'edit' && canEdit;

  // Dialogs
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);

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
      if (hasUnsavedChanges && isEditing) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges, isEditing]);

  // Only show skeleton on very first load (no previous data to display).
  // With placeholderData: keepPreviousData, the old page stays visible during navigation.
  if (isLoading && !page) {
    return (
      <div className="p-8">
        <div className="mb-4 h-10 w-64 animate-pulse rounded bg-muted" />
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  return (
    <div className={cn('relative transition-opacity duration-200', isPlaceholderData && 'opacity-60 pointer-events-none')}>
      {/* Keyboard Shortcuts Dialog (global, triggered by Ctrl+/) */}
      <KeyboardShortcutsDialog />

      {/* Table of Contents sidebar */}
      <TableOfContents editor={editorInstance} />

      {/* Main content area — offset for TOC sidebar on large screens */}
      <div className="px-8 py-4 lg:mr-64">
        {/* Breadcrumbs — full hierarchy: Space > ...ancestors > current page */}
        <Breadcrumbs
          className="mb-4"
          items={[
            { label: space?.name || slug, href: `/spaces/${slug}` },
            ...(ancestors || []).map((a) => ({
              label: a.title,
              href: `/spaces/${slug}/pages/${a.id}`,
            })),
            { label: page?.title || 'Page' },
          ]}
        />

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isEditing ? (
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (e.target.value !== page?.title) setHasUnsavedChanges(true);
                }}
                onBlur={handleSaveTitle}
                className="border-none bg-transparent text-3xl font-bold shadow-none focus-visible:ring-0 px-0"
                placeholder={t('pages.untitled')}
              />
            ) : (
              <h1 className="text-3xl font-bold truncate px-0">
                {title || page?.title || t('pages.untitled')}
              </h1>
            )}
            <button
              onClick={handleToggleFavorite}
              className={cn(
                'shrink-0 p-1.5 rounded-md transition-colors',
                favoriteStatus?.isFavorite
                  ? 'text-yellow-500 hover:text-yellow-600'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title={favoriteStatus?.isFavorite ? (t('pages.removeFromFavorites') || 'Remove from favorites') : (t('pages.addToFavorites') || 'Add to favorites')}
            >
              <Star className={cn('h-5 w-5', favoriteStatus?.isFavorite && 'fill-current')} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {page?.updatedAt && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(page.updatedAt).toLocaleDateString(locale)}
              </span>
            )}
            <PageExport editor={editorInstance} pageTitle={title || t('pages.untitled')} />

            {/* Version history button */}
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => setShowVersionHistory(true)}
            >
              <History className="h-4 w-4" />
              {t('pages.versionHistory')}
            </Button>

            {/* View/Edit toggle */}
            {mode === 'view' && canEdit && (
              <Button onClick={() => setMode('edit')} size="sm" className="gap-2">
                <Pencil className="h-4 w-4" />
                {t('pages.edit') || 'Edit'}
              </Button>
            )}
            {isEditing && (
              <>
                <Button onClick={handleSave} disabled={updatePage.isPending} size="sm" className="gap-2">
                  <Save className="h-4 w-4" />
                  {updatePage.isPending ? t('common.saving') : t('pages.save')}
                </Button>
                <Button onClick={() => {
                  if (hasUnsavedChanges) {
                    if (!window.confirm(t('pages.unsavedChangesWarning'))) return;
                  }
                  setMode('view');
                  setHasUnsavedChanges(false);
                }} size="sm" variant="ghost" className="gap-2">
                  <Eye className="h-4 w-4" />
                  {t('pages.view') || 'View'}
                </Button>
              </>
            )}

            {/* More actions dropdown */}
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
        </div>

        {/* Tags */}
        {page?.tags && (
          <div className="mb-4">
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

        {/* Collaborative Editor (Yjs + Hocuspocus) */}
        <CollaborativeEditor
          pageId={pageId}
          spaceSlug={slug}
          editable={isEditing}
          onEditorReady={handleEditorReady}
          initialContent={page?.contentJson as Record<string, unknown> | null}
          onContentChange={() => setHasUnsavedChanges(true)}
        />

        {/* Comments (collapsible) */}
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
    </div>
  );
}
