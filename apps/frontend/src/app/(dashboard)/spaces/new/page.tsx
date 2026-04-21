'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Globe, Lock, User, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateSpace } from '@/hooks/useSpaces';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

function createSpaceSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t('validation.nameRequired')).max(100),
    slug: z.string().min(1, t('validation.slugRequired')).max(100).regex(/^[a-z0-9-]+$/, t('validation.slugFormat')),
    description: z.string().max(500).optional(),
    type: z.enum(['PUBLIC', 'PRIVATE', 'PERSONAL']),
  });
}

type CreateSpaceValues = z.infer<ReturnType<typeof createSpaceSchema>>;

const ease = [0.22, 0.68, 0, 1.04] as const;

const spaceTypes = [
  { value: 'PUBLIC' as const, icon: Globe, descKey: 'spaces.new.typePublicDesc' },
  { value: 'PRIVATE' as const, icon: Lock, descKey: 'spaces.new.typePrivateDesc' },
  { value: 'PERSONAL' as const, icon: User, descKey: 'spaces.new.typePersonalDesc' },
] as const;

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

  const selectedType = watch('type');

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

  const spaceTypeDescs: Record<string, string> = {
    PUBLIC: t('spaces.new.typePublicDesc') || 'Anyone can view and join',
    PRIVATE: t('spaces.new.typePrivateDesc') || 'Invite-only access',
    PERSONAL: t('spaces.new.typePersonalDesc') || 'Only you can access',
  };

  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
      >
        <Link href="/spaces" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground/60 hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('spaces.new.backToSpaces')}
        </Link>

        <div className="mb-8">
          <h1 className="text-[1.5rem] font-bold tracking-[-0.02em]">{t('spaces.new.title')}</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-[13px] font-medium">{t('spaces.new.nameLabel')}</Label>
            <Input
              id="name"
              placeholder={t('spaces.new.namePlaceholder')}
              className="h-11 bg-muted/30 border-border/60 focus-visible:bg-background"
              {...register('name', {
                onChange: (e) => setValue('slug', generateSlug(e.target.value)),
              })}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="slug" className="text-[13px] font-medium">{t('spaces.new.slugLabel')}</Label>
            <Input
              id="slug"
              placeholder={t('spaces.new.slugPlaceholder')}
              className="h-11 bg-muted/30 border-border/60 focus-visible:bg-background font-mono text-sm"
              {...register('slug')}
            />
            {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-[13px] font-medium">{t('spaces.new.descriptionLabel')}</Label>
            <Input
              id="description"
              placeholder={t('spaces.new.descriptionPlaceholder')}
              className="h-11 bg-muted/30 border-border/60 focus-visible:bg-background"
              {...register('description')}
            />
          </div>

          {/* Type selector — card-style */}
          <div className="space-y-2">
            <Label className="text-[13px] font-medium">{t('spaces.new.typeLabel')}</Label>
            <div className="grid grid-cols-3 gap-2">
              {spaceTypes.map(({ value, icon: Icon }) => (
                <label
                  key={value}
                  className={cn(
                    'relative flex flex-col items-center gap-2 rounded-xl border p-4 cursor-pointer transition-all duration-200',
                    selectedType === value
                      ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                      : 'border-border/50 bg-muted/20 hover:border-border hover:bg-muted/40',
                  )}
                >
                  <input type="radio" value={value} {...register('type')} className="sr-only" />
                  <div className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                    selectedType === value
                      ? 'bg-primary/12 text-primary'
                      : 'bg-muted/60 text-muted-foreground/50',
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className={cn(
                    'text-xs font-medium transition-colors',
                    selectedType === value ? 'text-foreground' : 'text-muted-foreground/60',
                  )}>
                    {spaceTypeLabels[value]}
                  </span>
                  <span className="text-[10px] text-muted-foreground/40 text-center leading-snug">
                    {spaceTypeDescs[value]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-destructive/15 bg-destructive/5 px-4 py-3"
            >
              <p className="text-sm text-destructive">{error}</p>
            </motion.div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-11 gap-2 shadow-md shadow-primary/15 hover:shadow-lg hover:shadow-primary/20 transition-shadow"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{t('spaces.new.creating')}</>
            ) : (
              t('spaces.new.button')
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
