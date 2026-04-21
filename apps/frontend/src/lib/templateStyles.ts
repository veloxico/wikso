/**
 * Shared style tokens for page template categories.
 *
 * Used in two places with different visual densities:
 *   1. PageTemplatesDialog — large tile with colored icon chip (ring/bg/fg).
 *   2. AdminTemplatesPage   — compact badge + row accents (badgeBg/badgeFg).
 *
 * Keeping the palette in one place ensures the user-facing picker and the
 * admin table agree on what "Planning" looks like — so an admin editing a
 * Planning template sees the same amber tone the end user will see when
 * picking it.
 *
 * Keys match the canonical English category names written by the backend
 * (see TemplatesService.getDefaultTemplates and the CATEGORY_OPTIONS list
 * on the admin page). Unknown categories fall back to the "General" style.
 */
import { BookOpen, FileText, Lightbulb, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface TemplateCategoryStyle {
  /** Icon used on large tiles when a template has no custom emoji. */
  Icon: LucideIcon;
  /** Ring class for the 40×40 tile icon chip in the dialog. */
  ring: string;
  /** Background class for the 40×40 tile icon chip in the dialog. */
  bg: string;
  /** Foreground (text/icon) class for the 40×40 tile icon chip. */
  fg: string;
  /** Slightly more saturated bg for small pill badges in the admin table. */
  badgeBg: string;
  /** Foreground for small pill badges. Matches `fg` but kept separate for future tuning. */
  badgeFg: string;
  /** Border class for badges — we prefer bordered pills over solid fills
   *  because the admin table sits on the default card bg and solid pills
   *  would stand out too hard. */
  badgeBorder: string;
  /** Vertical accent line color for seeded/isDefault rows — a 2px left
   *  stripe on the first cell that signals "system template, edit with care". */
  accent: string;
}

export const CATEGORY_STYLES: Record<string, TemplateCategoryStyle> = {
  General: {
    Icon: FileText,
    ring: 'ring-slate-400/20',
    bg: 'bg-slate-500/10',
    fg: 'text-slate-300',
    badgeBg: 'bg-slate-500/10',
    badgeFg: 'text-slate-300',
    badgeBorder: 'border-slate-400/25',
    accent: 'bg-slate-400/60',
  },
  Planning: {
    Icon: Lightbulb,
    ring: 'ring-amber-400/30',
    bg: 'bg-amber-500/10',
    fg: 'text-amber-300',
    badgeBg: 'bg-amber-500/10',
    badgeFg: 'text-amber-300',
    badgeBorder: 'border-amber-400/30',
    accent: 'bg-amber-400/70',
  },
  Documentation: {
    Icon: BookOpen,
    ring: 'ring-sky-400/30',
    bg: 'bg-sky-500/10',
    fg: 'text-sky-300',
    badgeBg: 'bg-sky-500/10',
    badgeFg: 'text-sky-300',
    badgeBorder: 'border-sky-400/30',
    accent: 'bg-sky-400/70',
  },
  Team: {
    Icon: Users,
    ring: 'ring-emerald-400/30',
    bg: 'bg-emerald-500/10',
    fg: 'text-emerald-300',
    badgeBg: 'bg-emerald-500/10',
    badgeFg: 'text-emerald-300',
    badgeBorder: 'border-emerald-400/30',
    accent: 'bg-emerald-400/70',
  },
};

/** Canonical ordered list of category keys — use for UI iteration so the
 *  order stays stable (General → Planning → Documentation → Team). */
export const CATEGORY_KEYS = ['General', 'Planning', 'Documentation', 'Team'] as const;

/** Lookup helper with a safe fallback to the "General" style. */
export function templateCategoryStyle(category: string): TemplateCategoryStyle {
  return CATEGORY_STYLES[category] ?? CATEGORY_STYLES.General;
}
