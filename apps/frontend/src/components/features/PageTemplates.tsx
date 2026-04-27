'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Sparkles, ArrowUpRight, FileWarning } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/useTranslation';
import { api } from '@/lib/api';
import { templateCategoryStyle } from '@/lib/templateStyles';
import { useAuthStore } from '@/store/authStore';

interface PageTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (content: object) => void;
  spaceId?: string;
}

interface BackendTemplate {
  id: string;
  title: string;
  description: string | null;
  category: string;
  icon: string | null;
  contentJson: object;
  isDefault: boolean;
}

/**
 * Maps the English title of seeded default templates to the i18n key prefix
 * inside the `templates.*` namespace. Backend stores templates in English
 * (see TemplatesService.getDefaultTemplates), so we translate at render time
 * for default ones; admin-created templates show as authored.
 *
 * If an admin renames a default template via /admin/templates, the lookup
 * misses and we fall back to the stored title — acceptable, since the admin
 * has expressed intent to override.
 */
const DEFAULT_TEMPLATE_KEYS: Record<string, string> = {
  'Blank Page': 'blank',
  'Meeting Notes': 'meetingNotes',
  'Technical Spec': 'technicalSpec',
  'Onboarding Guide': 'onboardingGuide',
  'Decision Record': 'decisionRecord',
  Retrospective: 'retrospective',
};

const CATEGORY_KEYS: Record<string, string> = {
  General: 'general',
  Planning: 'planning',
  Documentation: 'documentation',
  Team: 'team',
};

export function PageTemplatesDialog({
  open,
  onOpenChange,
  onSelect,
  spaceId,
}: PageTemplatesDialogProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const { data, isLoading, isError } = useQuery<BackendTemplate[]>({
    queryKey: ['templates', spaceId ?? 'all'],
    queryFn: async () => {
      const url = spaceId ? `/templates?spaceId=${spaceId}` : '/templates';
      const { data } = await api.get(url);
      return data;
    },
    enabled: open,
  });

  const templates = data ?? [];

  const handleSelect = (template: BackendTemplate) => {
    onSelect(template.contentJson);
    onOpenChange(false);
  };

  // Resolve the localized strings for a template. For seeded defaults we look
  // up the i18n key by English title; everything else falls through to the
  // value stored in the DB (admin-created templates, or defaults whose admin
  // renamed them).
  const localizedTitle = (tpl: BackendTemplate): string => {
    if (tpl.isDefault) {
      const key = DEFAULT_TEMPLATE_KEYS[tpl.title];
      if (key) return t(`templates.${key}`);
    }
    return tpl.title;
  };
  const localizedDesc = (tpl: BackendTemplate): string | null => {
    if (tpl.isDefault) {
      const key = DEFAULT_TEMPLATE_KEYS[tpl.title];
      if (key) return t(`templates.${key}Desc`);
    }
    return tpl.description;
  };
  const localizedCategory = (tpl: BackendTemplate): string => {
    const key = CATEGORY_KEYS[tpl.category];
    return key ? t(`templates.categories.${key}`) : tpl.category;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('templates.title')}
          </DialogTitle>
          <DialogDescription>{t('templates.chooseTemplate')}</DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border/60 p-4 animate-pulse"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted/60" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded bg-muted/60" />
                    <div className="h-3 w-48 rounded bg-muted/40" />
                    <div className="h-3 w-20 rounded bg-muted/30 mt-2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center my-2">
            <FileWarning className="mx-auto mb-2 h-6 w-6 text-destructive" />
            <p className="text-sm text-muted-foreground">
              {t('templates.loadError')}
            </p>
          </div>
        )}

        {!isLoading && !isError && templates.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-10 text-center my-2">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-sm font-semibold">
              {t('templates.emptyTitle')}
            </h3>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              {t('templates.emptyDesc')}
            </p>
            {isAdmin && (
              <Link
                href="/admin/templates"
                onClick={() => onOpenChange(false)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {t('templates.manageTemplates')}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        )}

        {!isLoading && !isError && templates.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
              {templates.map((template) => {
                const style = templateCategoryStyle(template.category);
                const { Icon } = style;
                const title = localizedTitle(template);
                const description = localizedDesc(template);
                const category = localizedCategory(template);
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleSelect(template)}
                    className="group text-left rounded-xl border border-border/70 bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.4)] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${style.ring} ${style.bg} ${style.fg}`}
                      >
                        {template.icon ? (
                          <span className="text-lg leading-none">{template.icon}</span>
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold leading-tight mb-1 group-hover:text-primary transition-colors">
                          {title}
                        </h3>
                        {description && (
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                            {description}
                          </p>
                        )}
                        <span className="mt-2 inline-block text-[10px] uppercase tracking-[0.08em] text-muted-foreground/70">
                          {category}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {isAdmin && (
              <div className="pt-2 mt-1 border-t border-border/40">
                <Link
                  href="/admin/templates"
                  onClick={() => onOpenChange(false)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t('templates.manageTemplates')}
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
