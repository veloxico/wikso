'use client';

import { useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageTemplatesDialog } from '@/components/features/PageTemplates';
import { useCreatePage } from '@/hooks/usePages';
import { useTranslation } from '@/hooks/useTranslation';

export function NewPageButton() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const [showTemplates, setShowTemplates] = useState(false);

  // Extract current space slug from URL
  const slugMatch = pathname.match(/^\/spaces\/([^/]+)/);
  const slug = slugMatch?.[1] || '';

  const createPage = useCreatePage(slug);

  const handleTemplateSelect = useCallback(async (content: object) => {
    if (!slug) return;
    try {
      const newPage = await createPage.mutateAsync({
        title: t('pages.untitled'),
        contentJson: content as Record<string, unknown>,
      });
      router.push(`/spaces/${slug}/pages/${newPage.id}`);
    } catch {
      toast.error(t('pages.failedToCreate'));
    }
  }, [slug, createPage, router, t]);

  if (!slug) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setShowTemplates(true)}
      >
        <Plus className="h-4 w-4" />
        {t('pages.newPage')}
      </Button>
      {showTemplates && (
        <PageTemplatesDialog
          open={showTemplates}
          onOpenChange={setShowTemplates}
          onSelect={handleTemplateSelect}
        />
      )}
    </>
  );
}
