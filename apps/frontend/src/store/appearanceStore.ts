/**
 * Appearance store — controls the warm-paper design system at runtime.
 *
 * The state lives in localStorage so the user's preferences survive
 * reloads. Each setter also writes a `data-*` attribute (or inline
 * style) to <html> so the CSS in globals.css picks it up via the
 * `:root[data-accent="..."] { --accent-h: ... }` rules.
 *
 * - `theme`           — light / dark / system. Light/dark write the
 *                       Tailwind `class="dark"` toggle (handled by
 *                       next-themes via `useTheme()`); `system`
 *                       defers to OS preference.
 * - `accent`          — one of five hue presets. CSS recomputes
 *                       `--accent`, `--accent-soft`, `--accent-ink`,
 *                       `--accent-hover` from `--accent-h` + `--accent-c`.
 * - `uiFont`          — sans / serif / mono. Flips `--ui-font` only;
 *                       body documents always use Source Serif 4.
 * - `toolbarVariant`  — full / compact / minimal. Editor toolbar reads
 *                       this from `data-toolbar` (set on the toolbar
 *                       element by the editor component).
 * - `sidebarMode`     — hover / pinned. UnifiedSidebar reads this to
 *                       decide whether to expand on hover or stay
 *                       expanded permanently.
 *
 * Why a separate store from `sidebarStore`: that one tracks
 * `collapsed` + `width` for the existing draggable sidebar. The new
 * design's `sidebarMode` is an orthogonal preference (hover vs pin)
 * that the rail-mode sidebar honours when it's used. Keeping them
 * separate avoids breaking the draggable sidebar's existing API.
 */

import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';
export type Accent = 'terracotta' | 'ink' | 'moss' | 'plum' | 'sky';
export type UiFont = 'sans' | 'serif' | 'mono';
export type ToolbarVariant = 'full' | 'compact' | 'minimal';
export type SidebarMode = 'hover' | 'pinned';

interface AppearanceState {
  accent: Accent;
  uiFont: UiFont;
  toolbarVariant: ToolbarVariant;
  sidebarMode: SidebarMode;
  _hydrated: boolean;
  setAccent: (a: Accent) => void;
  setUiFont: (f: UiFont) => void;
  setToolbarVariant: (v: ToolbarVariant) => void;
  setSidebarMode: (m: SidebarMode) => void;
  hydrate: () => void;
}

/** Map accent ID → swatch colour for the picker UI. Mirrors the
 * lookup in globals.css `:root[data-accent="..."]`. */
export const ACCENT_PRESETS: Record<Accent, { hue: number; chroma: number; label: string; labelRu: string }> = {
  terracotta: { hue: 40,  chroma: 0.13, label: 'Terracotta', labelRu: 'Терракота' },
  ink:        { hue: 260, chroma: 0.11, label: 'Ink',        labelRu: 'Чернила' },
  moss:       { hue: 150, chroma: 0.10, label: 'Moss',       labelRu: 'Мох' },
  plum:       { hue: 340, chroma: 0.12, label: 'Plum',       labelRu: 'Слива' },
  sky:        { hue: 220, chroma: 0.10, label: 'Sky',        labelRu: 'Небо' },
};

const STORAGE_KEY = 'wikso-appearance-v1';

interface PersistedState {
  accent: Accent;
  uiFont: UiFont;
  toolbarVariant: ToolbarVariant;
  sidebarMode: SidebarMode;
}

function loadPersisted(): Partial<PersistedState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return parsed;
  } catch {
    return {};
  }
}

function persist(state: PersistedState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* localStorage may be unavailable (private mode); silently ignore */
  }
}

/** Apply a slice of state to <html> attributes. CSS variables
 * recompute, so all `--accent-*` derivatives update instantly. */
function applyToHtml(state: Partial<PersistedState>): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  if (state.accent) html.setAttribute('data-accent', state.accent);
  if (state.uiFont) html.setAttribute('data-uifont', state.uiFont);
}

export const useAppearanceStore = create<AppearanceState>((set, get) => ({
  accent: 'terracotta',
  uiFont: 'sans',
  toolbarVariant: 'full',
  sidebarMode: 'hover',
  _hydrated: false,

  hydrate: () => {
    if (get()._hydrated) return;
    const persisted = loadPersisted();
    const next: PersistedState = {
      accent: persisted.accent ?? 'terracotta',
      uiFont: persisted.uiFont ?? 'sans',
      toolbarVariant: persisted.toolbarVariant ?? 'full',
      sidebarMode: persisted.sidebarMode ?? 'hover',
    };
    set({ ...next, _hydrated: true });
    applyToHtml(next);
  },

  setAccent: (accent) => {
    set({ accent });
    const s = get();
    persist({ accent, uiFont: s.uiFont, toolbarVariant: s.toolbarVariant, sidebarMode: s.sidebarMode });
    applyToHtml({ accent });
  },

  setUiFont: (uiFont) => {
    set({ uiFont });
    const s = get();
    persist({ accent: s.accent, uiFont, toolbarVariant: s.toolbarVariant, sidebarMode: s.sidebarMode });
    applyToHtml({ uiFont });
  },

  setToolbarVariant: (toolbarVariant) => {
    set({ toolbarVariant });
    const s = get();
    persist({ accent: s.accent, uiFont: s.uiFont, toolbarVariant, sidebarMode: s.sidebarMode });
  },

  setSidebarMode: (sidebarMode) => {
    set({ sidebarMode });
    const s = get();
    persist({ accent: s.accent, uiFont: s.uiFont, toolbarVariant: s.toolbarVariant, sidebarMode });
  },
}));
