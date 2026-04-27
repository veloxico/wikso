'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageVersions } from '@/components/features/PageVersions';
import { useTranslation } from '@/hooks/useTranslation';

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  pageId: string;
  currentContent?: Record<string, unknown>;
}

export function VersionHistoryDialog({
  open,
  onOpenChange,
  slug,
  pageId,
  currentContent,
}: VersionHistoryDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl max-h-[80vh] overflow-y-auto"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--rule)',
          boxShadow: 'var(--pop-shadow)',
        }}
      >
        <DialogHeader>
          <DialogTitle
            style={{
              fontFamily: 'var(--body-font)',
              fontSize: '20px',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: 'var(--ink)',
            }}
          >
            {t('pages.versionHistoryTitle')}
          </DialogTitle>
        </DialogHeader>
        <div
          style={{
            paddingTop: 12,
            borderTop: '1px dashed var(--rule)',
          }}
        >
          <PageVersions slug={slug} pageId={pageId} currentContent={currentContent} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
