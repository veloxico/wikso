'use client';

import { Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useDeletePage } from '@/hooks/usePages';
import { useTranslation } from '@/hooks/useTranslation';

interface DeletePageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  pageTitle: string;
  slug: string;
  childCount?: number;
  onDeleted?: () => void;
}

export function DeletePageDialog({
  open,
  onOpenChange,
  pageId,
  pageTitle,
  slug,
  childCount = 0,
  onDeleted,
}: DeletePageDialogProps) {
  const { t } = useTranslation();
  const deletePage = useDeletePage(slug);

  const handleDelete = () => {
    deletePage.mutate(pageId, {
      onSuccess: () => {
        onOpenChange(false);
        onDeleted?.();
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('pages.moveToTrashTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('pages.moveToTrashDescription', { title: pageTitle })}
          </AlertDialogDescription>
          {childCount > 0 && (
            <p className="text-sm text-destructive font-medium mt-1">
              {t('pages.deletePageWithChildren', { count: childCount })}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {t('pages.trashHint')}
          </p>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletePage.isPending}>
            {t('common.cancel')}
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deletePage.isPending}
          >
            {deletePage.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <Trash2 className="h-4 w-4 mr-1" />
            {deletePage.isPending ? t('common.deleting') : t('pages.moveToTrash')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
