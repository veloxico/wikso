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
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('pages.versionHistoryTitle')}</DialogTitle>
        </DialogHeader>
        <PageVersions slug={slug} pageId={pageId} currentContent={currentContent} />
      </DialogContent>
    </Dialog>
  );
}
