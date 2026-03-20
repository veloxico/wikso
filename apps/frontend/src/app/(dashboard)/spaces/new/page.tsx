'use client';

import { useState, useMemo } from 'react';
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
import { useTranslation } from '@/hooks/useTranslation';

function createSpaceSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t('validation.nameRequired')).max(100),
    slug: z.string().min(1, t('validation.slugRequired')).max(100).regex(/^[a-z0-9-]+$/, t('validation.slugFormat')),
    description: z.string().max(500).optional(),
    type: z.enum(['PUBLIC', 'PRIVATE', 'PERSONAL']),
  });
}

type CreateSpaceValues = z.infer<ReturnType<typeof createSpaceSchema>>;

export default function NewSpacePage() {
  const router = useRouter();
  const createSpace = useCreateSpace();
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  const schema = useMemo(() => createSpaceSchema(t), [t]);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<CreateSpaceValues>({
    resolver: zodResolver(schema),
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
      setError(err.response?.data?.message || t('spaces.new.failed'));
    }
  };

  const spaceTypeLabels: Record<string, string> = {
    PUBLIC: t('common.public'),
    PRIVATE: t('common.private'),
    PERSONAL: t('common.personal'),
  };

  return (
    <div className="p-4 md:p-8">
      <Link href="/spaces" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        {t('spaces.new.backToSpaces')}
      </Link>

      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{t('spaces.new.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('spaces.new.nameLabel')}</Label>
              <Input
                id="name"
                placeholder={t('spaces.new.namePlaceholder')}
                {...register('name', {
                  onChange: (e) => setValue('slug', generateSlug(e.target.value)),
                })}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">{t('spaces.new.slugLabel')}</Label>
              <Input id="slug" placeholder={t('spaces.new.slugPlaceholder')} {...register('slug')} />
              {errors.slug && <p className="text-sm text-red-500">{errors.slug.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('spaces.new.descriptionLabel')}</Label>
              <Input id="description" placeholder={t('spaces.new.descriptionPlaceholder')} {...register('description')} />
            </div>

            <div className="space-y-2">
              <Label>{t('spaces.new.typeLabel')}</Label>
              <div className="flex gap-2">
                {(['PUBLIC', 'PRIVATE', 'PERSONAL'] as const).map((spaceType) => (
                  <label key={spaceType} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value={spaceType} {...register('type')} className="accent-primary" />
                    <span className="text-sm">{spaceTypeLabels[spaceType]}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t('spaces.new.creating') : t('spaces.new.button')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
