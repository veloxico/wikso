'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface PageVersion {
  id: string;
  pageId: string;
  contentJson: Record<string, unknown>;
  authorId: string;
  createdAt: string;
}

interface PageVersionsProps {
  slug: string;
  pageId: string;
  onPreview?: (content: Record<string, unknown>) => void;
}

function usePageVersions(slug: string, pageId: string) {
  return useQuery<PageVersion[]>({
    queryKey: ['versions', slug, pageId],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${slug}/pages/${pageId}/versions`);
      return data;
    },
    enabled: !!slug && !!pageId,
  });
}

export function PageVersions({ slug, pageId, onPreview }: PageVersionsProps) {
  const { data: versions, isLoading } = usePageVersions(slug, pageId);
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        <History className="mx-auto mb-2 h-6 w-6 text-muted-foreground/30" />
        No version history yet.
      </div>
    );
  }

  const displayVersions = expanded ? versions : versions.slice(0, 5);

  return (
    <div className="space-y-2">
      {displayVersions.map((version, index) => (
        <div
          key={version.id}
          className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-muted-foreground">v{versions.length - index}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(version.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">by {version.authorId}</p>
          </div>
          {onPreview && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => onPreview(version.contentJson)}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
          )}
        </div>
      ))}

      {versions.length > 5 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full gap-2"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" /> Show all {versions.length} versions
            </>
          )}
        </Button>
      )}
    </div>
  );
}
