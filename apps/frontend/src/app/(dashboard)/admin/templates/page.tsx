'use client';

import { useMemo, useState } from 'react';
import {
  LayoutTemplate,
  Search,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from '@/hooks/useAdminTemplates';
import type { Template } from '@/hooks/useAdminTemplates';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import {
  CATEGORY_KEYS,
  templateCategoryStyle,
} from '@/lib/templateStyles';
import { cn } from '@/lib/utils';

const DEFAULT_CONTENT_JSON = JSON.stringify(
  { type: 'doc', content: [{ type: 'paragraph' }] },
  null,
  2,
);

/**
 * Category names are the canonical English identifiers stored in the DB
 * (see TemplatesService.getDefaultTemplates and the backend's CATEGORY_OPTIONS).
 * The display labels come from i18n (`templates.categories.*`) — we translate
 * on render, same approach as PageTemplatesDialog.
 */
const CATEGORY_OPTIONS = CATEGORY_KEYS;

interface FormState {
  title: string;
  description: string;
  category: string;
  icon: string;
  isDefault: boolean;
  contentJsonText: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  category: 'General',
  icon: '',
  isDefault: false,
  contentJsonText: DEFAULT_CONTENT_JSON,
};

/**
 * Convert a canonical category name ("Planning") to the lowerCamelCase i18n
 * sub-key under `templates.categories.*` ("planning"). The admin list uses
 * the same label set as the end-user picker — consistency > wording variety.
 */
function categoryI18nKey(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function formatAbsoluteDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

/**
 * Lightweight relative-time formatter — keeps us off date-fns on this page.
 * For dates older than ~4 weeks we fall back to absolute format, because
 * "5w ago" is less useful than an actual date when auditing authorship.
 *
 * The absolute date is also exposed via a `title` attribute on the cell
 * so hovering still gives the precise timestamp.
 */
function useRelativeDate() {
  const { t } = useTranslation();
  return (value: string): string => {
    const then = new Date(value).getTime();
    if (Number.isNaN(then)) return value;
    const diffMs = Date.now() - then;
    const diffMin = Math.round(diffMs / 60_000);
    if (diffMin < 1) return t('admin.templates.relative.justNow');
    if (diffMin < 60) return t('admin.templates.relative.minutesAgo', { count: diffMin });
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return t('admin.templates.relative.hoursAgo', { count: diffHr });
    const diffDay = Math.round(diffHr / 24);
    if (diffDay === 1) return t('admin.templates.relative.yesterday');
    if (diffDay < 7) return t('admin.templates.relative.daysAgo', { count: diffDay });
    const diffWeek = Math.round(diffDay / 7);
    if (diffWeek < 4) return t('admin.templates.relative.weeksAgo', { count: diffWeek });
    return formatAbsoluteDate(value);
  };
}

// ── FilterChip ───────────────────────────────────────────────────────────
// Pill-style toggle for category + "All" filter. When `categoryName` is
// provided, the active state tints with that category's palette — the chip
// and the table badge then share the same color, so clicking a chip visually
// "zooms in" on rows of that color.
interface FilterChipProps {
  active: boolean;
  label: string;
  count: number;
  categoryName?: string;
  onClick: () => void;
}
function FilterChip({ active, label, count, categoryName, onClick }: FilterChipProps) {
  const style = categoryName ? templateCategoryStyle(categoryName) : null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70',
        active && style
          ? cn(style.badgeBg, style.badgeFg, style.badgeBorder)
          : active
          ? 'bg-primary/10 text-primary border-primary/30'
          : 'bg-transparent text-muted-foreground border-border/60 hover:bg-muted/50 hover:text-foreground',
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          'tabular-nums text-[10px] rounded px-1',
          active ? 'bg-background/30' : 'bg-muted/50',
        )}
      >
        {count}
      </span>
    </button>
  );
}

export default function AdminTemplatesPage() {
  const { t } = useTranslation();
  const relativeDate = useRelativeDate();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<Template | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: templates, isLoading } = useTemplates();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplateMutation = useDeleteTemplate();

  // Per-category counts power the chip badges and the stats strip. We
  // pre-seed with all canonical categories so a chip reading "Planning 0"
  // renders consistently even when no Planning templates exist yet.
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const key of CATEGORY_OPTIONS) counts[key] = 0;
    if (templates) {
      for (const tpl of templates) {
        counts[tpl.category] = (counts[tpl.category] ?? 0) + 1;
      }
    }
    return counts;
  }, [templates]);

  const defaultCount = useMemo(
    () => (templates ?? []).filter((tpl) => tpl.isDefault).length,
    [templates],
  );
  const totalCount = templates?.length ?? 0;
  const customCount = totalCount - defaultCount;

  const filtered = useMemo(() => {
    if (!templates) return [];
    let list = templates;
    if (categoryFilter) {
      list = list.filter((tpl) => tpl.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (tpl) =>
          tpl.title.toLowerCase().includes(q) ||
          (tpl.description?.toLowerCase().includes(q) ?? false) ||
          tpl.category.toLowerCase().includes(q),
      );
    }
    return list;
  }, [templates, search, categoryFilter]);

  const hasAny = totalCount > 0;
  const hasActiveFilter = search.trim().length > 0 || categoryFilter !== null;

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter(null);
  };

  const resetForm = () => setForm(EMPTY_FORM);

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const openEdit = (tpl: Template) => {
    setForm({
      title: tpl.title,
      description: tpl.description ?? '',
      category: tpl.category,
      icon: tpl.icon ?? '',
      isDefault: tpl.isDefault,
      contentJsonText: JSON.stringify(tpl.contentJson ?? {}, null, 2),
    });
    setEditTemplate(tpl);
  };

  const parseContentJson = (): object | null => {
    try {
      const parsed = JSON.parse(form.contentJsonText);
      if (typeof parsed !== 'object' || parsed === null) {
        toast.error(t('admin.templates.invalidJson'));
        return null;
      }
      return parsed;
    } catch {
      toast.error(t('admin.templates.invalidJson'));
      return null;
    }
  };

  const handleCreate = () => {
    if (!form.title.trim()) return;
    const contentJson = parseContentJson();
    if (!contentJson) return;
    createTemplate.mutate(
      {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category.trim() || 'General',
        icon: form.icon.trim() || undefined,
        isDefault: form.isDefault,
        contentJson,
      },
      {
        onSuccess: () => {
          setShowCreate(false);
          resetForm();
        },
      },
    );
  };

  const handleEditSave = () => {
    if (!editTemplate || !form.title.trim()) return;
    const contentJson = parseContentJson();
    if (!contentJson) return;
    updateTemplate.mutate(
      {
        id: editTemplate.id,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category.trim() || 'General',
        icon: form.icon.trim() || undefined,
        isDefault: form.isDefault,
        contentJson,
      },
      {
        onSuccess: () => {
          setEditTemplate(null);
          resetForm();
        },
      },
    );
  };

  const handleDelete = () => {
    if (!deleteTemplate) return;
    deleteTemplateMutation.mutate(deleteTemplate.id, {
      onSuccess: () => setDeleteTemplate(null),
    });
  };

  const renderFormFields = () => (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>{t('admin.templates.title_field')}</Label>
        <Input
          value={form.title}
          onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
          placeholder={t('admin.templates.title_field')}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('admin.templates.description_field')}</Label>
        <Input
          value={form.description}
          onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
          placeholder={t('admin.templates.description_field')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>{t('admin.templates.category')}</Label>
          <select
            value={form.category}
            onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {t(`templates.categories.${categoryI18nKey(opt)}`)}
              </option>
            ))}
            {/* Allow showing an "orphan" category name if the template was
                saved with a value that's no longer in CATEGORY_OPTIONS — cast
                widens the literal tuple to accept arbitrary strings. */}
            {!(CATEGORY_OPTIONS as readonly string[]).includes(form.category) &&
              form.category && (
                <option value={form.category}>{form.category}</option>
              )}
          </select>
        </div>

        <div className="space-y-2">
          <Label>{t('admin.templates.icon')}</Label>
          <Input
            value={form.icon}
            onChange={(e) => setForm((s) => ({ ...s, icon: e.target.value }))}
            placeholder="📝"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 select-none cursor-pointer">
        <input
          type="checkbox"
          checked={form.isDefault}
          onChange={(e) => setForm((s) => ({ ...s, isDefault: e.target.checked }))}
          className="h-4 w-4 rounded border-input"
        />
        <span className="text-sm">{t('admin.templates.isDefault')}</span>
      </label>

      <div className="space-y-2">
        <Label>{t('admin.templates.contentJson')}</Label>
        <textarea
          value={form.contentJsonText}
          onChange={(e) => setForm((s) => ({ ...s, contentJsonText: e.target.value }))}
          rows={10}
          spellCheck={false}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground">{t('admin.templates.contentJsonHelp')}</p>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-4 sm:mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <LayoutTemplate className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{t('admin.templates.title')}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t('admin.templates.description')}
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">{t('admin.templates.create')}</span>
        </Button>
      </div>

      {/* Stats strip — compact typographic summary; no card to preserve the
          editorial feel. Hidden when there's nothing to summarise. */}
      {hasAny && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.1em] text-muted-foreground tabular-nums">
          <span>{t('admin.templates.stats.total', { count: totalCount })}</span>
          <span className="text-muted-foreground/40" aria-hidden>·</span>
          <span>{t('admin.templates.stats.default', { count: defaultCount })}</span>
          <span className="text-muted-foreground/40" aria-hidden>·</span>
          <span>{t('admin.templates.stats.custom', { count: customCount })}</span>
        </div>
      )}

      {/* Search + category chips. Only rendered when there's anything to
          filter — on a truly empty state the CTA empty panel does the job. */}
      {hasAny && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('admin.templates.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip
              active={categoryFilter === null}
              count={totalCount}
              label={t('admin.templates.filterAll')}
              onClick={() => setCategoryFilter(null)}
            />
            {CATEGORY_OPTIONS.map((key) => (
              <FilterChip
                key={key}
                active={categoryFilter === key}
                count={categoryCounts[key] ?? 0}
                label={t(`templates.categories.${categoryI18nKey(key)}`)}
                categoryName={key}
                onClick={() =>
                  setCategoryFilter((cur) => (cur === key ? null : key))
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Templates table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            hasActiveFilter ? (
              // No-match empty state — active search or filter returned nothing.
              // Offers a single recovery action to clear and start over.
              <div className="py-12 text-center">
                <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                <h3 className="text-sm font-semibold mb-1">
                  {t('admin.templates.empty.searchTitle')}
                </h3>
                <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
                  {t('admin.templates.empty.searchDesc', {
                    query:
                      search.trim() ||
                      (categoryFilter
                        ? t(`templates.categories.${categoryI18nKey(categoryFilter)}`)
                        : ''),
                  })}
                </p>
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  {t('admin.templates.empty.clearSearch')}
                </Button>
              </div>
            ) : (
              // Truly-empty state — no templates exist at all. CTA to create one.
              <div className="py-12 text-center">
                <LayoutTemplate className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                <h3 className="text-sm font-semibold mb-1">
                  {t('admin.templates.empty.noneTitle')}
                </h3>
                <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
                  {t('admin.templates.empty.noneDesc')}
                </p>
                <Button size="sm" onClick={openCreate} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('admin.templates.empty.createFirst')}
                </Button>
              </div>
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-3 font-medium text-muted-foreground w-10"></th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      {t('admin.templates.title_field')}
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      {t('admin.templates.category')}
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground hidden md:table-cell">
                      {t('admin.templates.description_field')}
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground hidden lg:table-cell">
                      {t('admin.templates.createdAt')}
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right pr-2">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tpl) => {
                    const style = templateCategoryStyle(tpl.category);
                    return (
                      <tr
                        key={tpl.id}
                        className="group border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        {/* Icon cell doubles as the seeded-marker container:
                            a 2px left stripe in the category color marks
                            system templates so admins instantly spot what
                            will be re-created by the seed on next deploy. */}
                        <td className="relative py-3 pl-3 align-middle">
                          {tpl.isDefault && (
                            <span
                              className={cn(
                                'absolute left-0 top-1 bottom-1 w-[2px] rounded-full',
                                style.accent,
                              )}
                              aria-hidden
                              title={t('admin.templates.seeded')}
                            />
                          )}
                          <span className="text-lg" aria-hidden>
                            {tpl.icon || '📄'}
                          </span>
                        </td>
                        <td className="py-3 align-middle font-medium">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate">{tpl.title}</span>
                            {tpl.isDefault && (
                              <span
                                title={t('admin.templates.seeded')}
                                className="shrink-0 text-[9px] uppercase tracking-wider font-semibold text-muted-foreground/80 px-1.5 py-0.5 rounded border border-border/60"
                              >
                                {t('admin.templates.isDefault')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 align-middle">
                          <span
                            className={cn(
                              'inline-flex items-center text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border',
                              style.badgeBg,
                              style.badgeFg,
                              style.badgeBorder,
                            )}
                          >
                            {t(`templates.categories.${categoryI18nKey(tpl.category)}`)}
                          </span>
                        </td>
                        <td className="py-3 align-middle text-muted-foreground hidden md:table-cell max-w-xs truncate">
                          {tpl.description || '—'}
                        </td>
                        <td className="py-3 align-middle text-muted-foreground hidden lg:table-cell tabular-nums whitespace-nowrap">
                          <span title={formatAbsoluteDate(tpl.createdAt)}>
                            {relativeDate(tpl.createdAt)}
                          </span>
                        </td>
                        {/* Actions — revealed on hover/focus to reduce visual
                            noise when scanning. On touch devices we always
                            show them (no hover affordance there). */}
                        <td className="py-3 align-middle text-right pr-2">
                          <div
                            className={cn(
                              'inline-flex gap-1 transition-opacity',
                              'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
                              '[@media(hover:none)]:opacity-100',
                            )}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title={t('admin.templates.edit')}
                              onClick={() => openEdit(tpl)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              title={t('admin.templates.delete')}
                              onClick={() => setDeleteTemplate(tpl)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('admin.templates.create')}</DialogTitle>
            <DialogDescription>{t('admin.templates.description')}</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 pr-1">{renderFormFields()}</div>
          <div className="flex justify-end gap-2 pt-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                resetForm();
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!form.title.trim() || createTemplate.isPending}
            >
              {createTemplate.isPending ? t('common.creating') : t('admin.templates.create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!editTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setEditTemplate(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('admin.templates.edit')}</DialogTitle>
            <DialogDescription>{editTemplate?.title}</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 pr-1">{renderFormFields()}</div>
          <div className="flex justify-end gap-2 pt-3">
            <Button
              variant="outline"
              onClick={() => {
                setEditTemplate(null);
                resetForm();
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={!form.title.trim() || updateTemplate.isPending}
            >
              {updateTemplate.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTemplate}
        onOpenChange={(open) => !open && setDeleteTemplate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.templates.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTemplate?.title}
              <br />
              {t('admin.templates.deleteWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteTemplateMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTemplateMutation.isPending
                ? t('common.deleting')
                : t('admin.templates.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
