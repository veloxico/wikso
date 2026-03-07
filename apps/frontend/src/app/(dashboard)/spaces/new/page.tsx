'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateSpace } from '@/hooks/useSpaces';

const createSpaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().min(1, 'Slug is required').max(100).regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers and hyphens'),
  description: z.string().max(500).optional(),
  type: z.enum(['PUBLIC', 'PRIVATE', 'PERSONAL']),
});

type CreateSpaceValues = z.infer<typeof createSpaceSchema>;

export default function NewSpacePage() {
  const router = useRouter();
  const createSpace = useCreateSpace();
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<CreateSpaceValues>({
    resolver: zodResolver(createSpaceSchema),
    defaultValues: { type: 'PUBLIC' },
  });

  const nameValue = watch('name');

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const onSubmit = async (data: CreateSpaceValues) => {
    try {
      setError(null);
      await createSpace.mutateAsync(data);
      router.push(`/spaces/${data.slug}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create space');
    }
  };

  return (
    <div className="p-8">
      <Link href="/spaces" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Spaces
      </Link>

      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>Create a new space</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Engineering"
                {...register('name', {
                  onChange: (e) => setValue('slug', generateSlug(e.target.value)),
                })}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" placeholder="engineering" {...register('slug')} />
              {errors.slug && <p className="text-sm text-red-500">{errors.slug.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input id="description" placeholder="A space for engineering docs" {...register('description')} />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex gap-2">
                {(['PUBLIC', 'PRIVATE', 'PERSONAL'] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value={t} {...register('type')} className="accent-primary" />
                    <span className="text-sm capitalize">{t.toLowerCase()}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Space'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
