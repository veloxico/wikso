'use client';

import { useState } from 'react';
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
import { ChevronRight, FileText, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { Page } from '@/types';

interface PageTreeNodeProps {
  page: Page;
  slug: string;
  level: number;
}

function SortablePageNode({ page, slug, level }: PageTreeNodeProps) {
  const pathname = usePathname();
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
        <button
          {...attributes}
          {...listeners}
          className="flex h-4 w-4 shrink-0 cursor-grab items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-3 w-3" />
        </button>

        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex h-4 w-4 shrink-0 items-center justify-center"
          >
            <ChevronRight
              className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')}
            />
          </button>
        ) : (
          <span className="h-4 w-4" />
        )}
        <FileText className="h-4 w-4 shrink-0" />
        <Link
          href={`/spaces/${slug}/pages/${page.id}`}
          className="flex-1 truncate"
        >
          {page.title}
        </Link>
      </div>
      {hasChildren && expanded && (
        <SortableContext
          items={page.children!.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {page.children!.map((child) => (
            <SortablePageNode key={child.id} page={child} slug={slug} level={level + 1} />
          ))}
        </SortableContext>
      )}
    </div>
  );
}

interface PageTreeProps {
  pages: Page[];
  slug: string;
}

export function PageTree({ pages, slug }: PageTreeProps) {
  const queryClient = useQueryClient();
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

    // Find position of the target
    const flatPages = flattenPages(pages);
    const overIndex = flatPages.findIndex((p) => p.id === over.id);
    if (overIndex >= 0) {
      movePage.mutate({ pageId: active.id as string, position: overIndex });
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-0.5">
          {pages.map((page) => (
            <SortablePageNode key={page.id} page={page} slug={slug} level={0} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
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
