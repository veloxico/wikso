'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { History, Eye, ChevronDown, ChevronUp, GitCompareArrows, X, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { VersionDiff } from './VersionDiff';
import { toast } from 'sonner';

interface PageVersion {
  id: string;
  pageId: string;
  contentJson: Record<string, unknown>;
  authorId: string;
  createdAt: string;
  author?: { id: string; name: string; avatarUrl?: string };
}

interface PageVersionsProps {
  slug: string;
  pageId: string;
  currentContent?: Record<string, unknown>;
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

export function PageVersions({ slug, pageId, currentContent, onPreview }: PageVersionsProps) {
  const { data: versions, isLoading } = usePageVersions(slug, pageId);
  const [expanded, setExpanded] = useState(false);
  const [diffVersions, setDiffVersions] = useState<{ old: PageVersion; new: PageVersion } | null>(null);
  const { t, locale } = useTranslation();
  const queryClient = useQueryClient();

  const restoreVersion = useMutation({
    mutationFn: async (versionId: string) => {
      const { data } = await api.post(`/spaces/${slug}/pages/${pageId}/versions/${versionId}/restore`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions', slug, pageId] });
      queryClient.invalidateQueries({ queryKey: ['pages', slug, pageId] });
      toast.success(t('pages.versionRestored') || 'Version restored successfully');
    },
    onError: () => {
      toast.error(t('pages.versionRestoreFailed') || 'Failed to restore version');
    },
  });

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
        {t('pages.noVersionHistory')}
      </div>
    );
  }

  const displayVersions = expanded ? versions : versions.slice(0, 5);

  const handleCompare = (version: PageVersion, index: number) => {
    // Compare with the next (newer) version, or current content
    if (index === 0 && currentContent) {
      // Compare latest version with current content
      setDiffVersions({
        old: version,
        new: { ...version, id: 'current', contentJson: currentContent, createdAt: new Date().toISOString() },
      });
    } else if (index > 0) {
      // Compare with the previous version in list (which is newer)
      setDiffVersions({
        old: version,
        new: versions[index - 1],
      });
    }
  };

  return (
    <div className="space-y-2">
      {/* Diff view */}
      {diffVersions && (
        <div className="mb-4 rounded-lg border border-border bg-card/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4" />
              Version Comparison
            </h4>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setDiffVersions(null)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <VersionDiff
            oldContent={diffVersions.old.contentJson}
            newContent={diffVersions.new.contentJson}
            oldLabel={`v${versions.indexOf(diffVersions.old) >= 0 ? versions.length - versions.indexOf(diffVersions.old) : '?'}`}
            newLabel={diffVersions.new.id === 'current' ? 'Current' : `v${versions.length - versions.indexOf(diffVersions.new)}`}
          />
        </div>
      )}

      {displayVersions.map((version, index) => (
        <div
          key={version.id}
          className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-muted-foreground">v{versions.length - index}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(version.createdAt).toLocaleString(locale)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{t('pages.byAuthor', { name: version.author?.name || t('pages.unknown') })}</p>
          </div>
          <div className="flex items-center gap-1">
            {/* Compare button — show when there's something to compare with */}
            {(index > 0 || currentContent) && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => handleCompare(version, index)}
                title="Compare with newer version"
              >
                <GitCompareArrows className="h-3.5 w-3.5" />
              </Button>
            )}
            {onPreview && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => onPreview(version.contentJson)}
              >
                <Eye className="h-3.5 w-3.5" />
                {t('pages.preview')}
              </Button>
            )}
            {/* Restore button — don't show for the latest version */}
            {index > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-primary hover:text-primary"
                onClick={() => restoreVersion.mutate(version.id)}
                disabled={restoreVersion.isPending}
                title={t('pages.restoreVersion') || 'Restore this version'}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
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
              <ChevronUp className="h-4 w-4" /> {t('pages.showLess')}
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" /> {t('pages.showAllVersions', { count: versions.length })}
            </>
          )}
        </Button>
      )}
    </div>
  );
}
