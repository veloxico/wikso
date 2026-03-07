'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Save, Clock, History, MessageSquare } from 'lucide-react';
import { usePage, useUpdatePage } from '@/hooks/usePages';
import { useSpace } from '@/hooks/useSpaces';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Attachments } from '@/components/features/Attachments';
import { PageVersions } from '@/components/features/PageVersions';
import { Comments } from '@/components/features/Comments';
import { Breadcrumbs } from '@/components/features/Breadcrumbs';
import { toast } from 'sonner';

// Динамический импорт — Yjs / Hocuspocus не работают на сервере
const CollaborativeEditor = dynamic(
  () => import('@/components/features/CollaborativeEditor').then((m) => m.CollaborativeEditor),
  { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-lg bg-muted" /> }
);

export default function PageEditorPage() {
  const params = useParams();
  const slug = params.slug as string;
  const pageId = params.pageId as string;

  const { data: page, isLoading } = usePage(slug, pageId);
  const { data: space } = useSpace(slug);
  const updatePage = useUpdatePage(slug, pageId);
  const [title, setTitle] = useState('');
  const [titleInitialized, setTitleInitialized] = useState(false);

  if (page && !titleInitialized) {
    setTitle(page.title);
    setTitleInitialized(true);
  }

  const handleSaveTitle = useCallback(() => {
    if (title && title !== page?.title) {
      updatePage.mutate(
        { title },
        {
          onSuccess: () => toast.success('Title saved'),
          onError: () => toast.error('Failed to save title'),
        },
      );
    }
  }, [title, page, updatePage]);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="mb-4 h-10 w-64 animate-pulse rounded bg-muted" />
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: space?.name || slug, href: `/spaces/${slug}` },
          { label: page?.title || 'Page' },
        ]}
      />

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSaveTitle}
          className="border-none bg-transparent text-3xl font-bold shadow-none focus-visible:ring-0 px-0"
          placeholder="Untitled"
        />
        <div className="flex items-center gap-2">
          {page?.updatedAt && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(page.updatedAt).toLocaleDateString()}
            </span>
          )}
          <Button onClick={handleSaveTitle} disabled={updatePage.isPending} size="sm" className="gap-2">
            <Save className="h-4 w-4" />
            {updatePage.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Collaborative Editor (Yjs + Hocuspocus) */}
      <CollaborativeEditor pageId={pageId} />

      {/* Attachments */}
      <div className="mt-8 border-t border-border pt-6">
        <Attachments pageId={pageId} />
      </div>

      {/* Version History */}
      <div className="mt-6 border-t border-border pt-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4" />
          Version History
        </h3>
        <PageVersions slug={slug} pageId={pageId} />
      </div>

      {/* Comments */}
      <div className="mt-6 border-t border-border pt-6">
        <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments
        </h3>
        <Comments pageId={pageId} />
      </div>
    </div>
  );
}
