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
      // Backend returns paginated { data: PageVersion[], total, skip, take }
      return Array.isArray(data) ? data : data?.data ?? [];
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

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {displayVersions.map((version, index) => {
          const isLatest = index === 0;
          return (
            <div
              key={version.id}
              className="flex items-center justify-between gap-3 px-1 py-3 text-sm group/version"
              style={{
                borderTop: index === 0 ? 0 : '1px dashed var(--rule)',
              }}
            >
              {/* Version mark + author */}
              <div className="min-w-0 flex-1 flex items-center gap-3">
                <div
                  className="shrink-0 grid place-items-center rounded-md text-[11px] font-bold"
                  style={{
                    width: 32,
                    height: 32,
                    fontFamily: 'var(--ui-font)',
                    background: isLatest ? 'var(--accent)' : 'var(--bg-sunken)',
                    color: isLatest ? 'var(--bg)' : 'var(--ink-3)',
                    border: isLatest ? 0 : '1px solid var(--rule)',
                  }}
                >
                  {versions.length - index}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-[13px]"
                      style={{
                        color: 'var(--ink)',
                        fontFamily: 'var(--body-font)',
                        fontWeight: 500,
                      }}
                    >
                      {version.author?.name || t('pages.unknown')}
                    </span>
                    {isLatest && (
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-px rounded"
                        style={{
                          color: 'var(--accent)',
                          border: '1px solid var(--accent)',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {t('pages.current') || 'Latest'}
                      </span>
                    )}
                  </div>
                  <div
                    className="text-[11.5px] mt-0.5"
                    style={{
                      color: 'var(--ink-4)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {new Date(version.createdAt).toLocaleString(locale)}
                  </div>
                </div>
              </div>

              {/* Inline actions — only visible on hover for less clutter */}
              <div className="flex items-center gap-1 opacity-60 group-hover/version:opacity-100 transition-opacity">
                {(index > 0 || currentContent) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    style={{ color: 'var(--ink-3)' }}
                    onClick={() => handleCompare(version, index)}
                    title={t('pages.compareNewer') || 'Compare with newer'}
                  >
                    <GitCompareArrows className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onPreview && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    style={{ color: 'var(--ink-3)' }}
                    onClick={() => onPreview(version.contentJson)}
                    title={t('pages.preview')}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                )}
                {index > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    style={{ color: 'var(--accent)' }}
                    onClick={() => restoreVersion.mutate(version.id)}
                    disabled={restoreVersion.isPending}
                    title={t('pages.restoreVersion') || 'Restore this version'}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
