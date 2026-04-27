'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
import { ChevronRight, GripVertical, Trash2, Plus, MoveHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { DeletePageDialog } from '@/components/features/DeletePageDialog';
import { MovePageDialog } from '@/components/features/MovePageDialog';
import type { Page } from '@/types';

/* ── Constants ── */
const INDENT_PX = 12;

/* ── Right-click context menu ── */
interface ContextMenuState {
  page: Page;
  x: number;
  y: number;
}

function TreeContextMenu({
  state,
  onClose,
  onCreateChild,
  onMove,
  onDelete,
  t,
}: {
  state: ContextMenuState;
  onClose: () => void;
  onCreateChild?: (parentId: string) => void;
  onMove?: (page: Page) => void;
  onDelete?: (page: Page) => void;
  t: (key: string) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [onClose]);

  // Clamp position to stay within viewport
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${Math.min(state.x, window.innerWidth - 180)}px`,
    top: `${Math.min(state.y, window.innerHeight - 150)}px`,
    zIndex: 9999,
  };

  return (
    <div ref={ref} style={menuStyle} className="min-w-[160px] rounded-md border border-border bg-popover py-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100">
      {onCreateChild && (
        <button
          onClick={() => { onCreateChild(state.page.id); onClose(); }}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('pages.createChildPage')}
        </button>
      )}
      {onMove && (
        <button
          onClick={() => { onMove(state.page); onClose(); }}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent transition-colors"
        >
          <MoveHorizontal className="h-3.5 w-3.5" />
          {t('pages.movePage') || 'Move'}
        </button>
      )}
      {(onCreateChild || onMove) && onDelete && (
        <div className="my-1 h-px bg-border" />
      )}
      {onDelete && (
        <button
          onClick={() => { onDelete(state.page); onClose(); }}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-destructive hover:bg-accent transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t('common.delete')}
        </button>
      )}
    </div>
  );
}

/* ── Page tree node props ── */
interface PageTreeNodeProps {
  page: Page;
  slug: string;
  level: number;
  onDeletePage?: (page: Page) => void;
  onCreateChildPage?: (parentId: string) => void;
  onMovePage?: (page: Page) => void;
  onContextMenu?: (e: React.MouseEvent, page: Page) => void;
  /** Callback to auto-collapse siblings when expanding */
  onExpand?: (pageId: string) => void;
  /** Externally controlled expanded set (for auto-collapse) */
  expandedIds?: Set<string>;
}

function SortablePageNode({
  page, slug, level, onDeletePage, onCreateChildPage, onMovePage,
  onContextMenu, onExpand, expandedIds,
}: PageTreeNodeProps) {
  const pathname = usePathname();
  const hasChildren = page.children && page.children.length > 0;
  const isActive = pathname === `/spaces/${slug}/pages/${page.id}`;

  // Use external expanded state if provided (for auto-collapse), otherwise local
  const isControlled = expandedIds !== undefined;
  const [localExpanded, setLocalExpanded] = useState(level < 2);
  const expanded = isControlled ? expandedIds.has(page.id) : localExpanded;

  const handleToggle = useCallback(() => {
    if (isControlled) {
      onExpand?.(page.id);
    } else {
      setLocalExpanded((v) => !v);
    }
  }, [isControlled, onExpand, page.id]);

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

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          'group relative flex items-center rounded-md py-[5px] pr-1 text-[13px] transition-colors',
          isActive
            ? 'bg-accent text-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
        )}
        style={{ paddingLeft: `${level * INDENT_PX + 4}px` }}
        onContextMenu={(e) => { if (onContextMenu) { e.preventDefault(); onContextMenu(e, page); } }}
      >
        {/* Drag handle — appears on hover over the chevron area */}
        <button
          {...attributes}
          {...listeners}
          className="absolute flex h-full w-4 cursor-grab items-center justify-center opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity"
          style={{ left: `${level * INDENT_PX}px` }}
          tabIndex={-1}
        >
          <GripVertical className="h-2.5 w-2.5" />
        </button>

        {/* Expand/collapse chevron — only for parents, leaves get no spacer */}
        {hasChildren ? (
          <button
            onClick={handleToggle}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-accent"
          >
            <ChevronRight
              className={cn('h-3 w-3 transition-transform duration-150', expanded && 'rotate-90')}
            />
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Page link — Notion-style: just the title, maximum space */}
        <Link
          href={`/spaces/${slug}/pages/${page.id}`}
          className="flex-1 truncate pl-0.5"
          title={page.title}
        >
          {page.title}
        </Link>

        {/* Status badge */}
        {page.status === 'DRAFT' && (
          <span className="text-[9px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-medium shrink-0 ml-1">
            D
          </span>
        )}

        {/* Quick add child button — only on hover */}
        {onCreateChildPage && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCreateChildPage(page.id); }}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            title="+"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
      {hasChildren && expanded && (
        <SortableContext
          items={page.children!.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {page.children!.map((child) => (
            <SortablePageNode
              key={child.id}
              page={child}
              slug={slug}
              level={level + 1}
              onDeletePage={onDeletePage}
              onCreateChildPage={onCreateChildPage}
              onMovePage={onMovePage}
              onContextMenu={onContextMenu}
              onExpand={onExpand}
              expandedIds={expandedIds}
            />
          ))}
        </SortableContext>
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
  const [pageToDelete, setPageToDelete] = useState<Page | null>(null);
  const [pageToMove, setPageToMove] = useState<Page | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Auto-collapse siblings: track expanded page IDs.
  // When a page is expanded at level ≥2, siblings at the same level auto-collapse.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Start with root & level-1 pages expanded
    const initial = new Set<string>();
    for (const p of pages) {
      initial.add(p.id);
      if (p.children) {
        for (const c of p.children) {
          initial.add(c.id);
        }
      }
    }
    return initial;
  });

  // When pages change (new page added), update expanded set
  useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      for (const p of pages) {
        if (!next.has(p.id)) next.add(p.id);
      }
      return next;
    });
  }, [pages]);

  const handleExpand = useCallback((pageId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        // Collapse this page
        next.delete(pageId);
      } else {
        // Expand this page — auto-collapse siblings at same level
        // Find siblings by looking through the tree
        const siblings = findSiblings(pages, pageId);
        if (siblings) {
          for (const sib of siblings) {
            if (sib.id !== pageId) next.delete(sib.id);
          }
        }
        next.add(pageId);
      }
      return next;
    });
  }, [pages]);

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

  const handleContextMenu = useCallback((e: React.MouseEvent, page: Page) => {
    e.preventDefault();
    setContextMenu({ page, x: e.clientX, y: e.clientY });
  }, []);

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-px">
            {pages.map((page) => (
              <SortablePageNode
                key={page.id}
                page={page}
                slug={slug}
                level={0}
                onDeletePage={setPageToDelete}
                onCreateChildPage={onCreateChildPage}
                onMovePage={setPageToMove}
                onContextMenu={handleContextMenu}
                onExpand={handleExpand}
                expandedIds={expandedIds}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Right-click context menu */}
      {contextMenu && (
        <TreeContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
          onCreateChild={onCreateChildPage}
          onMove={setPageToMove}
          onDelete={setPageToDelete}
          t={t}
        />
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
            if (pathname === `/spaces/${slug}/pages/${pageToDelete.id}`) {
              window.location.href = `/spaces/${slug}`;
            }
          }}
        />
      )}

      {/* Move Page Dialog */}
      {pageToMove && (
        <MovePageDialog
          open={!!pageToMove}
          onOpenChange={(open) => { if (!open) setPageToMove(null); }}
          pageId={pageToMove.id}
          pageTitle={pageToMove.title}
          currentParentId={pageToMove.parentId}
          slug={slug}
          onMoved={() => setPageToMove(null)}
        />
      )}
    </div>
  );
}

/* ── Helpers ── */

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

/** Find siblings of a page by its ID in a nested tree. */
function findSiblings(pages: Page[], targetId: string): Page[] | null {
  // Check if target is at this level
  for (const p of pages) {
    if (p.id === targetId) return pages;
  }
  // Search deeper
  for (const p of pages) {
    if (p.children) {
      const found = findSiblings(p.children, targetId);
      if (found) return found;
    }
  }
  return null;
}
