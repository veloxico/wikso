'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';

interface AddMemberDialogProps {
  slug: string;
}

export function AddMemberDialog({ slug }: AddMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('EDITOR');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const addMember = useMutation({
    mutationFn: async () => {
      await api.post(`/spaces/${slug}/members`, { userId, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', slug, 'members'] });
      setOpen(false);
      setUserId('');
      setRole('EDITOR');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || t('addMember.failedToAdd'));
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" />
          {t('addMember.title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addMember.title')}</DialogTitle>
          <DialogDescription>{t('addMember.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="userId">{t('addMember.userIdLabel')}</Label>
            <Input
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder={t('addMember.userIdPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('addMember.roleLabel')}</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">{t('roles.admin')}</SelectItem>
                <SelectItem value="EDITOR">{t('roles.editor')}</SelectItem>
                <SelectItem value="VIEWER">{t('roles.viewer')}</SelectItem>
                <SelectItem value="GUEST">{t('common.guest')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={() => addMember.mutate()}
              disabled={!userId.trim() || addMember.isPending}
            >
              {addMember.isPending ? t('addMember.adding') : t('addMember.button')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
