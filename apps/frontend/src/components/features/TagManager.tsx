'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, X, Tag, Hash } from 'lucide-react';
import { useTags, useCreateTag, useAddTagToPage, useRemoveTagFromPage } from '@/hooks/useTags';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { tagStyle } from '@/lib/tagColor';

interface TagManagerProps {
  slug: string;
  pageId: string;
  pageTags: Array<{ tagId: string; tag: { id: string; name: string } }>;
}

/**
 * Inline tag editor. Renders chips as `.wp-tag` paper-stamps (each chip
 * gets a deterministic hue from the tag's name) and offers a popover to
 * add an existing tag from the space's library or create a new one.
 *
 * The popover uses the warm-paper `wp-tag-picker` surface so it visually
 * belongs to the same family as the slash menu and command palette.
 */
export function TagManager({ slug, pageId, pageTags }: TagManagerProps) {
  const { t } = useTranslation();
  const { data: allTags } = useTags(slug);
  const createTag = useCreateTag(slug);
  const addTag = useAddTagToPage(slug, pageId);
  const removeTag = useRemoveTagFromPage(slug, pageId);
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentTagIds = new Set(pageTags.map((pt) => pt.tagId));
  const availableTags = allTags?.filter((tag) => !currentTagIds.has(tag.id)) || [];

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Auto-focus input when picker opens
  useEffect(() => {
    if (open) {
      // small delay so the popover renders before focus()
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const handleCreateAndAdd = async () => {
    const name = newTagName.trim();
    if (!name) return;
    // If an existing tag matches case-insensitively, use it instead of duplicating
    const existing = allTags?.find(
      (t) => t.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      if (!currentTagIds.has(existing.id)) addTag.mutate(existing.id);
    } else {
      const tag = await createTag.mutateAsync(name);
      if (tag?.id) addTag.mutate(tag.id);
    }
    setNewTagName('');
  };

  // Filter available tags by typed query for incremental search
  const query = newTagName.trim().toLowerCase();
  const filteredAvailable = query
    ? availableTags.filter((t) => t.name.toLowerCase().includes(query))
    : availableTags;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Tag
        className="h-3.5 w-3.5"
        style={{ color: 'var(--ink-4)' }}
        aria-hidden
      />

      {pageTags.map((pt) => (
        <span key={pt.tagId} className="wp-tag" style={tagStyle(pt.tag.name)}>
          {pt.tag.name}
          <button
            type="button"
            className="wp-tag-x"
            onClick={() => removeTag.mutate(pt.tagId)}
            aria-label={`${t('common.remove') || 'Remove'} ${pt.tag.name}`}
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
          aria-label={t('tags.addTag') || 'Add tag'}
          title={t('tags.addTag') || 'Add tag'}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>

        {open && (
          <div
            className="wp-tag-picker absolute left-0 top-full z-50 mt-1.5"
            role="dialog"
            aria-label={t('tags.addTag') || 'Add tag'}
          >
            {/* Composer / search row */}
            <div
              className="flex items-center gap-1.5 px-1 pb-2"
              style={{ borderBottom: '1px dashed var(--rule)', marginBottom: 6 }}
            >
              <Hash
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: 'var(--ink-4)' }}
                aria-hidden
              />
              <Input
                ref={inputRef}
                placeholder={t('tags.addTag') || 'Type to search or create…'}
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateAndAdd();
                  }
                }}
                className="h-7 text-xs"
                style={{
                  background: 'transparent',
                  border: 0,
                  boxShadow: 'none',
                  paddingLeft: 4,
                }}
              />
              {newTagName.trim() && (
                <button
                  type="button"
                  onClick={handleCreateAndAdd}
                  disabled={createTag.isPending}
                  className="shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold uppercase"
                  style={{
                    letterSpacing: '0.06em',
                    background: 'var(--accent)',
                    color: 'var(--bg)',
                    border: 0,
                  }}
                >
                  {t('tags.create') || 'New'}
                </button>
              )}
            </div>

            {/* Existing tag list — preview chip + count */}
            {filteredAvailable.length > 0 ? (
              <div className="max-h-40 overflow-y-auto" style={{ paddingRight: 2 }}>
                {filteredAvailable.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className="wp-tag-picker-row"
                    onClick={() => {
                      addTag.mutate(tag.id);
                      setOpen(false);
                      setNewTagName('');
                    }}
                  >
                    <span className="wp-tag" style={tagStyle(tag.name)}>
                      {tag.name}
                    </span>
                    {tag._count ? (
                      <span className="count">{tag._count.pages}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <div
                className="px-2 py-3 text-center text-xs"
                style={{ color: 'var(--ink-4)' }}
              >
                {newTagName.trim()
                  ? t('tags.pressEnterToCreate') || 'Press Enter to create'
                  : t('tags.empty') || 'No tags yet'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
