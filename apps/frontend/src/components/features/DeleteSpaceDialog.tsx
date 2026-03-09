'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDeleteSpace } from '@/hooks/useSpaces';
import { useTranslation } from '@/hooks/useTranslation';

interface DeleteSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceName: string;
  slug: string;
}

export function DeleteSpaceDialog({
  open,
  onOpenChange,
  spaceName,
  slug,
}: DeleteSpaceDialogProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const deleteSpace = useDeleteSpace();
  const [confirmText, setConfirmText] = useState('');

  const canDelete = confirmText === spaceName;

  const handleDelete = () => {
    if (!canDelete) return;
    deleteSpace.mutate(slug, {
      onSuccess: () => {
        onOpenChange(false);
        router.push('/spaces');
      },
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmText('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!deleteSpace.isPending}>
        <DialogHeader>
          <DialogTitle>{t('spaces.settings.deleteSpaceTitle')}</DialogTitle>
          <DialogDescription>
            {t('spaces.settings.deleteSpaceDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            {t('spaces.settings.typeToConfirm').replace('{name}', spaceName)}
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={spaceName}
            onKeyDown={(e) => e.key === 'Enter' && canDelete && handleDelete()}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={deleteSpace.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || deleteSpace.isPending}
          >
            {deleteSpace.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {deleteSpace.isPending ? t('common.deleting') : t('spaces.settings.deleteSpace')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
