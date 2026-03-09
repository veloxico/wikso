'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, X, Tag } from 'lucide-react';
import { useTags, useCreateTag, useAddTagToPage, useRemoveTagFromPage } from '@/hooks/useTags';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TagManagerProps {
  slug: string;
  pageId: string;
  pageTags: Array<{ tagId: string; tag: { id: string; name: string } }>;
}

export function TagManager({ slug, pageId, pageTags }: TagManagerProps) {
  const { t } = useTranslation();
  const { data: allTags } = useTags(slug);
  const createTag = useCreateTag(slug);
  const addTag = useAddTagToPage(slug, pageId);
  const removeTag = useRemoveTagFromPage(slug, pageId);
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentTagIds = new Set(pageTags.map((pt) => pt.tagId));
  const availableTags = allTags?.filter((tag) => !currentTagIds.has(tag.id)) || [];

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleCreateAndAdd = async () => {
    if (!newTagName.trim()) return;
    const tag = await createTag.mutateAsync(newTagName.trim());
    if (tag?.id) {
      addTag.mutate(tag.id);
    }
    setNewTagName('');
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
      {pageTags.map((pt) => (
        <span
          key={pt.tagId}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
        >
          {pt.tag.name}
          <button
            onClick={() => removeTag.mutate(pt.tagId)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      <div className="relative" ref={dropdownRef}>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 rounded-full"
          onClick={() => setOpen(!open)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>

        {open && (
          <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-md border bg-popover p-2 shadow-md">
            <div className="space-y-2">
              {availableTags.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => {
                        addTag.mutate(tag.id);
                        setOpen(false);
                      }}
                      className="w-full text-left px-2 py-1 text-sm rounded hover:bg-accent transition-colors"
                    >
                      {tag.name}
                      {tag._count && (
                        <span className="ml-1 text-muted-foreground">({tag._count.pages})</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-1">
                <Input
                  placeholder={t('tags.addTag')}
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateAndAdd();
                    }
                  }}
                  className="h-7 text-xs"
                />
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleCreateAndAdd}
                  disabled={!newTagName.trim() || createTag.isPending}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
