'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Settings, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSpace } from '@/hooks/useSpaces';
import { usePages, useCreatePage } from '@/hooks/usePages';
import { PageTree } from '@/components/features/PageTree';
import { Button } from '@/components/ui/button';

export default function SpaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { data: space } = useSpace(slug);
  const { data: pages, isLoading } = usePages(slug);
  const createPage = useCreatePage(slug);

  const handleNewPage = async () => {
    try {
      const newPage = await createPage.mutateAsync({ title: 'Untitled' });
      router.push(`/spaces/${slug}/pages/${newPage.id}`);
    } catch {
      toast.error('Failed to create page');
    }
  };

  return (
    <div className="flex h-full">
      {/* Space sidebar with page tree */}
      <aside className="flex w-64 flex-col border-r border-border bg-sidebar/50">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="truncate text-sm font-semibold">
            {space?.name || 'Loading...'}
          </h2>
          <div className="flex gap-1">
            <Link href={`/spaces/${slug}/settings`}>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={handleNewPage}
            disabled={createPage.isPending}
          >
            {createPage.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            New Page
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {isLoading && (
            <div className="space-y-2 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-muted" />
              ))}
            </div>
          )}
          {pages && <PageTree pages={pages} slug={slug} />}
        </div>
      </aside>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
