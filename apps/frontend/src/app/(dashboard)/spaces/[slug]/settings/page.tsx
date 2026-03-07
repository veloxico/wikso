'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSpace } from '@/hooks/useSpaces';
import { AddMemberDialog } from '@/components/features/AddMemberDialog';
import { api } from '@/lib/api';

const settingsSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['PUBLIC', 'PRIVATE', 'PERSONAL']),
});

type SettingsValues = z.infer<typeof settingsSchema>;

interface SpaceMember {
  userId: string;
  name?: string;
  email?: string;
  role: string;
}

export default function SpaceSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const slug = params.slug as string;
  const { data: space, isLoading: spaceLoading, error: spaceError } = useSpace(slug);

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

  const deleteSpace = useMutation({
    mutationFn: async () => {
      await api.delete(`/spaces/${slug}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      router.push('/spaces');
    },
  });

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
      setError(err.response?.data?.message || 'Failed to update');
    }
  };

  if (spaceLoading) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="space-y-6">
          <div className="h-9 w-48 animate-pulse rounded bg-muted" />
          <div className="h-64 animate-pulse rounded-lg border bg-muted/50" />
        </div>
      </div>
    );
  }

  if (spaceError) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold">Failed to load space</h2>
          <p className="mb-4 text-sm text-muted-foreground">Could not load space settings. The space may not exist or you may not have access.</p>
          <Button variant="outline" onClick={() => router.push('/spaces')}>
            Back to Spaces
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link href={`/spaces/${slug}`} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to space
      </Link>

      <h1 className="mb-6 text-3xl font-bold">Space Settings</h1>

      {/* General */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" {...register('description')} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex gap-3">
                {(['PUBLIC', 'PRIVATE', 'PERSONAL'] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value={t} {...register('type')} className="accent-primary" />
                    <span className="text-sm capitalize">{t.toLowerCase()}</span>
                  </label>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {success && <p className="text-sm text-green-500">Settings saved!</p>}
            <Button type="submit" className="gap-2" disabled={isSubmitting}>
              <Save className="h-4 w-4" />
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Members */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Members</CardTitle>
          <AddMemberDialog slug={slug} />
        </CardHeader>
        <CardContent>
          {members && members.length > 0 ? (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{m.name || m.userId}</p>
                    {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{m.role}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">Deleting a space removes all pages and data permanently.</p>
          <Button
            variant="destructive"
            className="gap-2"
            onClick={() => {
              if (confirm('Are you sure? This cannot be undone.')) {
                deleteSpace.mutate();
              }
            }}
            disabled={deleteSpace.isPending}
          >
            <Trash2 className="h-4 w-4" />
            Delete Space
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
