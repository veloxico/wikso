'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, FileText, GripVertical, Search, X, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { DeletePageDialog } from '@/components/features/DeletePageDialog';
import type { Page } from '@/types';

interface PageTreeNodeProps {
  page: Page;
  slug: string;
  level: number;
  searchQuery?: string;
  onDeletePage?: (page: Page) => void;
  onCreateChildPage?: (parentId: string) => void;
}

function SortablePageNode({ page, slug, level, searchQuery, onDeletePage, onCreateChildPage }: PageTreeNodeProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const hasChildren = page.children && page.children.length > 0;
  const isActive = pathname === `/spaces/${slug}/pages/${page.id}`;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Highlight matching text
  const titleContent = useMemo(() => {
    if (!searchQuery) return page.title;
    const idx = page.title.toLowerCase().indexOf(searchQuery.toLowerCase());
    if (idx === -1) return page.title;
    const before = page.title.slice(0, idx);
    const match = page.title.slice(idx, idx + searchQuery.length);
    const after = page.title.slice(idx + searchQuery.length);
    return (
      <>
        {before}<mark className="bg-yellow-200 dark:bg-yellow-800 rounded-sm px-0.5">{match}</mark>{after}
      </>
    );
  }, [page.title, searchQuery]);

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
        )}
        style={{ paddingLeft: `${level * 16 + 4}px` }}
      >
        {/* Drag handle */}
        {!searchQuery && (
          <button
            {...attributes}
            {...listeners}
            className="flex h-4 w-4 shrink-0 cursor-grab items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="h-3 w-3" />
          </button>
        )}

        {hasChildren && !searchQuery ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex h-4 w-4 shrink-0 items-center justify-center"
          >
            <ChevronRight
              className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')}
            />
          </button>
        ) : (
          !searchQuery && <span className="h-4 w-4" />
        )}

        <FileText className="h-4 w-4 shrink-0" />
        <Link
          href={`/spaces/${slug}/pages/${page.id}`}
          className="flex-1 truncate"
        >
          {titleContent}
        </Link>

        {/* Create child page button (hover) */}
        {onCreateChildPage && !searchQuery && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCreateChildPage(page.id); }}
            className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all"
            title={t('pages.createChildPage')}
          >
            <Plus className="h-3 w-3" />
          </button>
        )}

        {/* Delete button (hover) */}
        {onDeletePage && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeletePage(page); }}
            className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}

        {/* Status badge */}
        {page.status === 'DRAFT' && (
          <span className="text-[9px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-medium">
            D
          </span>
        )}
      </div>
      {hasChildren && expanded && !searchQuery && (
        <SortableContext
          items={page.children!.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {page.children!.map((child) => (
            <SortablePageNode key={child.id} page={child} slug={slug} level={level + 1} onDeletePage={onDeletePage} onCreateChildPage={onCreateChildPage} />
          ))}
        </SortableContext>
      )}
    </div>
  );
}

/** Lightweight page node for search results — no DndContext/useSortable dependency. */
function SearchPageNode({ page, slug, searchQuery, onDeletePage }: Omit<PageTreeNodeProps, 'level'>) {
  const pathname = usePathname();
  const isActive = pathname === `/spaces/${slug}/pages/${page.id}`;

  const titleContent = useMemo(() => {
    if (!searchQuery) return page.title;
    const idx = page.title.toLowerCase().indexOf(searchQuery.toLowerCase());
    if (idx === -1) return page.title;
    const before = page.title.slice(0, idx);
    const match = page.title.slice(idx, idx + searchQuery.length);
    const after = page.title.slice(idx + searchQuery.length);
    return (
      <>
        {before}<mark className="bg-yellow-200 dark:bg-yellow-800 rounded-sm px-0.5">{match}</mark>{after}
      </>
    );
  }, [page.title, searchQuery]);

  return (
    <div
      className={cn(
        'group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
      )}
      style={{ paddingLeft: '4px' }}
    >
      <FileText className="h-4 w-4 shrink-0" />
      <Link href={`/spaces/${slug}/pages/${page.id}`} className="flex-1 truncate">
        {titleContent}
      </Link>
      {onDeletePage && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeletePage(page); }}
          className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
      {page.status === 'DRAFT' && (
        <span className="text-[9px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-medium">D</span>
      )}
    </div>
  );
}

interface PageTreeProps {
  pages: Page[];
  slug: string;
  onCreateChildPage?: (parentId: string) => void;
}

export function PageTree({ pages, slug, onCreateChildPage }: PageTreeProps) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [pageToDelete, setPageToDelete] = useState<Page | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const movePage = useMutation({
    mutationFn: async ({ pageId, position }: { pageId: string; position: number }) => {
      await api.patch(`/spaces/${slug}/pages/${pageId}/move`, { position });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages', slug] });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const flatPages = flattenPages(pages);
    const overIndex = flatPages.findIndex((p) => p.id === over.id);
    if (overIndex >= 0) {
      movePage.mutate({ pageId: active.id as string, position: overIndex });
    }
  };

  // Filter pages when searching
  const filteredPages = useMemo(() => {
    if (!search) return pages;
    const query = search.toLowerCase();
    const allPages = flattenPages(pages);
    return allPages.filter((p) => p.title.toLowerCase().includes(query));
  }, [pages, search]);

  const isSearching = search.length > 0;

  return (
    <div>
      {/* Search input */}
      <div className="relative mb-2 px-1">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Filter pages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-7 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Results count when searching */}
      {isSearching && (
        <p className="text-[10px] text-muted-foreground px-3 mb-1">
          {filteredPages.length} result{filteredPages.length !== 1 ? 's' : ''}
        </p>
      )}

      {isSearching ? (
        // Flat search results — no DndContext needed
        <div className="space-y-0.5">
          {filteredPages.map((page) => (
            <SearchPageNode key={page.id} page={page} slug={slug} searchQuery={search} onDeletePage={setPageToDelete} />
          ))}
          {filteredPages.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground text-center">
              No pages match your search
            </p>
          )}
        </div>
      ) : (
        // Normal tree with DnD
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-0.5">
              {pages.map((page) => (
                <SortablePageNode key={page.id} page={page} slug={slug} level={0} onDeletePage={setPageToDelete} onCreateChildPage={onCreateChildPage} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Delete Page Dialog */}
      {pageToDelete && (
        <DeletePageDialog
          open={!!pageToDelete}
          onOpenChange={(open) => { if (!open) setPageToDelete(null); }}
          pageId={pageToDelete.id}
          pageTitle={pageToDelete.title}
          slug={slug}
          childCount={pageToDelete.children?.length || 0}
          onDeleted={() => {
            setPageToDelete(null);
            // If user is on the deleted page, redirect to space root
            if (pathname === `/spaces/${slug}/pages/${pageToDelete.id}`) {
              window.location.href = `/spaces/${slug}`;
            }
          }}
        />
      )}
    </div>
  );
}

function flattenPages(pages: Page[]): Page[] {
  const result: Page[] = [];
  for (const page of pages) {
    result.push(page);
    if (page.children) {
      result.push(...flattenPages(page.children));
    }
  }
  return result;
}
