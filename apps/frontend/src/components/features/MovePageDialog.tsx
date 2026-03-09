'use client';

import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, FileText, Home, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { usePages } from '@/hooks/usePages';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Page } from '@/types';

interface MovePageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  pageTitle: string;
  currentParentId?: string | null;
  slug: string;
  onMoved?: () => void;
}

/** Collect IDs of all descendants of a given page (excluding the page itself). */
function getDescendantIds(pages: Page[], pageId: string): Set<string> {
  const ids = new Set<string>();
  function collectChildren(children: Page[]) {
    for (const c of children) {
      ids.add(c.id);
      if (c.children) collectChildren(c.children);
    }
  }
  function find(nodes: Page[]) {
    for (const node of nodes) {
      if (node.id === pageId) {
        if (node.children) collectChildren(node.children);
      } else if (node.children) {
        find(node.children);
      }
    }
  }
  find(pages);
  return ids;
}

function PageTreeItem({
  page,
  level,
  selectedId,
  disabledIds,
  onSelect,
}: {
  page: Page;
  level: number;
  selectedId: string | null;
  disabledIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = page.children && page.children.length > 0;
  const isDisabled = disabledIds.has(page.id);
  const isSelected = selectedId === page.id;

  return (
    <div>
      <button
        onClick={() => !isDisabled && onSelect(page.id)}
        disabled={isDisabled}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors text-left',
          isSelected
            ? 'bg-primary text-primary-foreground'
            : isDisabled
              ? 'text-muted-foreground/40 cursor-not-allowed'
              : 'text-foreground hover:bg-accent',
        )}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setExpanded(!expanded);
            }}
            className="shrink-0 p-0.5"
          >
            <ChevronRight
              className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')}
            />
          </span>
        ) : (
          <span className="w-4.5" />
        )}
        <FileText className="h-4 w-4 shrink-0" />
        <span className="truncate flex-1">{page.title}</span>
        {isSelected && <Check className="h-4 w-4 shrink-0" />}
      </button>
      {hasChildren &&
        expanded &&
        page.children!.map((child) => (
          <PageTreeItem
            key={child.id}
            page={child}
            level={level + 1}
            selectedId={selectedId}
            disabledIds={disabledIds}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

export function MovePageDialog({
  open,
  onOpenChange,
  pageId,
  pageTitle,
  currentParentId,
  slug,
  onMoved,
}: MovePageDialogProps) {
  const { t } = useTranslation();
  const { data: pages = [] } = usePages(slug);
  const queryClient = useQueryClient();

  // null = space root (top level), string = specific parent page
  const [selectedParentId, setSelectedParentId] = useState<string | null>(
    currentParentId ?? null,
  );

  const disabledIds = useMemo(() => {
    const ids = new Set<string>();
    ids.add(pageId); // Can't move under itself
    const descendants = getDescendantIds(pages, pageId);
    descendants.forEach((id) => ids.add(id));
    return ids;
  }, [pages, pageId]);

  const isRootSelected = selectedParentId === null;

  const movePage = useMutation({
    mutationFn: async () => {
      await api.patch(`/spaces/${slug}/pages/${pageId}/move`, {
        parentId: selectedParentId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages', slug] });
      queryClient.invalidateQueries({
        queryKey: ['pages', slug, pageId, 'ancestors'],
      });
      toast.success(t('pages.pageMoved') || 'Page moved successfully');
      onOpenChange(false);
      onMoved?.();
    },
    onError: () => {
      toast.error(t('pages.movePageFailed') || 'Failed to move page');
    },
  });

  const handleMove = useCallback(() => {
    const normalizedCurrent = currentParentId ?? null;
    if (selectedParentId === normalizedCurrent) {
      onOpenChange(false);
      return;
    }
    movePage.mutate();
  }, [selectedParentId, currentParentId, movePage, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('pages.movePageTitle') || 'Move Page'}</DialogTitle>
          <DialogDescription>
            {(t('pages.movePageDescription') || 'Select a new location for "{title}"').replace(
              '{title}',
              pageTitle,
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto border rounded-md p-2 space-y-0.5">
          {/* Root option (top level) */}
          <button
            onClick={() => setSelectedParentId(null)}
            className={cn(
              'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors text-left',
              isRootSelected
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-accent',
            )}
          >
            <Home className="h-4 w-4 shrink-0" />
            <span className="flex-1">{t('pages.spaceRoot') || 'Space root (top level)'}</span>
            {isRootSelected && <Check className="h-4 w-4 shrink-0" />}
          </button>

          {/* Page tree */}
          {pages.map((page) => (
            <PageTreeItem
              key={page.id}
              page={page}
              level={0}
              selectedId={selectedParentId}
              disabledIds={disabledIds}
              onSelect={setSelectedParentId}
            />
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleMove}
            disabled={
              movePage.isPending ||
              selectedParentId === (currentParentId ?? null)
            }
          >
            {movePage.isPending
              ? t('pages.movingPage') || 'Moving...'
              : t('pages.movePage') || 'Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
