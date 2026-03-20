'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Trash2, Users, UsersRound, X } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSpace } from '@/hooks/useSpaces';
import { AddMemberDialog } from '@/components/features/AddMemberDialog';
import { DeleteSpaceDialog } from '@/components/features/DeleteSpaceDialog';
import { api } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';

function createSettingsSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t('validation.nameRequired')).max(100),
    description: z.string().max(500).optional(),
    type: z.enum(['PUBLIC', 'PRIVATE', 'PERSONAL']),
  });
}

type SettingsValues = z.infer<ReturnType<typeof createSettingsSchema>>;

interface SpaceMember {
  id: string;
  userId: string | null;
  groupId: string | null;
  role: string;
  user?: { id: string; name: string; email: string } | null;
  group?: { id: string; name: string; description?: string | null } | null;
}

export default function SpaceSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const slug = params.slug as string;
  const { data: space, isLoading: spaceLoading, error: spaceError } = useSpace(slug);
  const { t } = useTranslation();

  const settingsSchema = useMemo(() => createSettingsSchema(t), [t]);

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
  });

  useEffect(() => {
    if (space) {
      reset({ name: space.name, description: space.description || '', type: space.type });
    }
  }, [space, reset]);

  const updateSpace = useMutation({
    mutationFn: async (data: SettingsValues) => {
      const res = await api.patch(`/spaces/${slug}`, data);
      return res.data;
    },
    onSuccess: () => {
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', slug] });
    },
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: members } = useQuery<SpaceMember[]>({
    queryKey: ['spaces', slug, 'members'],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${slug}/members`);
      return data;
    },
    enabled: !!slug,
  });

  const onSubmit = async (data: SettingsValues) => {
    setError(null);
    setSuccess(false);
    try {
      await updateSpace.mutateAsync(data);
    } catch (err: any) {
      setError(err.response?.data?.message || t('spaces.settings.failedToUpdate'));
    }
  };

  const spaceTypeLabels: Record<string, string> = {
    PUBLIC: t('common.public'),
    PRIVATE: t('common.private'),
    PERSONAL: t('common.personal'),
  };

  if (spaceLoading) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-8">
        <div className="space-y-6">
          <div className="h-9 w-48 animate-pulse rounded bg-muted" />
          <div className="h-64 animate-pulse rounded-lg border bg-muted/50" />
        </div>
      </div>
    );
  }

  if (spaceError) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold">{t('spaces.settings.loadFailed')}</h2>
          <p className="mb-4 text-sm text-muted-foreground">{t('spaces.settings.loadFailedDescription')}</p>
          <Button variant="outline" onClick={() => router.push('/spaces')}>
            {t('spaces.new.backToSpaces')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <Link href={`/spaces/${slug}`} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        {t('spaces.settings.backToSpace')}
      </Link>

      <h1 className="mb-6 text-3xl font-bold">{t('spaces.settings.title')}</h1>

      {/* General */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('spaces.settings.general')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('common.name')}</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t('common.description')}</Label>
              <Input id="description" {...register('description')} />
            </div>
            <div className="space-y-2">
              <Label>{t('common.type')}</Label>
              <div className="flex gap-3">
                {(['PUBLIC', 'PRIVATE', 'PERSONAL'] as const).map((spaceType) => (
                  <label key={spaceType} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value={spaceType} {...register('type')} className="accent-primary" />
                    <span className="text-sm">{spaceTypeLabels[spaceType]}</span>
                  </label>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {success && <p className="text-sm text-green-500">{t('spaces.settings.saved')}</p>}
            <Button type="submit" className="gap-2" disabled={isSubmitting}>
              <Save className="h-4 w-4" />
              {t('spaces.settings.save')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Members */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('spaces.settings.members')}</CardTitle>
          <AddMemberDialog slug={slug} />
        </CardHeader>
        <CardContent>
          {members && members.length > 0 ? (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div className="flex items-center gap-2">
                    {m.groupId ? (
                      <UsersRound className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Users className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {m.group ? m.group.name : m.user?.name || m.userId}
                      </p>
                      {m.user?.email && (
                        <p className="text-xs text-muted-foreground">{m.user.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{m.role}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        try {
                          if (m.groupId) {
                            await api.delete(`/spaces/${slug}/members/group/${m.groupId}`);
                          } else if (m.userId) {
                            await api.delete(`/spaces/${slug}/members/${m.userId}`);
                          }
                          queryClient.invalidateQueries({ queryKey: ['spaces', slug, 'members'] });
                        } catch {}
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('spaces.settings.noMembers')}</p>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">{t('spaces.settings.dangerZone')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">{t('spaces.settings.deleteWarning')}</p>
          <Button
            variant="destructive"
            className="gap-2"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4" />
            {t('spaces.settings.deleteSpace')}
          </Button>
        </CardContent>
      </Card>

      {/* Delete Space Confirmation Dialog */}
      {space && (
        <DeleteSpaceDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          slug={slug}
          spaceName={space.name}
        />
      )}
    </div>
  );
}
