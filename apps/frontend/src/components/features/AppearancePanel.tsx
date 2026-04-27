'use client';

/**
 * AppearancePanel — floating "tweaks" panel that lets the user re-skin the
 * UI live (theme, accent hue, UI font, toolbar density, sidebar behaviour).
 *
 * The trigger lives in the sidebar next to the user-menu button (see
 * `AppearanceTrigger`); the panel itself slides up from the bottom-left
 * corner anchored to that trigger. We render in a Portal so the panel
 * always sits above sidebar/main no matter what z-index hierarchy any
 * nested component sets.
 *
 * Open-state is in `useAppearancePanel` (zustand) so the trigger and
 * the panel can live in different parts of the React tree without
 * having to thread props.
 *
 * Theme uses next-themes (`useTheme`) since that's already wired into the
 * <html class="dark"> toggle. Accent / font / toolbar / sidebar live in
 * `useAppearanceStore` and write `data-*` attributes that globals.css
 * picks up.
 *
 * Why not put this in /settings? Two reasons: (1) the "tweaks" pattern
 * (Linear, Notion, Bear) makes it feel exploratory and reversible —
 * users *try* an accent and see it instantly, then commit. (2) Power
 * users want to flip themes without three clicks of nav.
 *
 * Keyboard: Esc closes the panel. The trigger lives in the sidebar; we
 * don't intercept any global shortcuts because that surface is owned
 * by the command palette (Cmd/Ctrl+K).
 */

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import {
  useAppearanceStore,
  ACCENT_PRESETS,
  type Accent,
  type UiFont,
  type ToolbarVariant,
  type SidebarMode,
} from '@/store/appearanceStore';
import { useAppearancePanel } from '@/store/appearancePanelStore';

export function AppearancePanel() {
  const { t, locale } = useTranslation();
  const { theme, setTheme } = useTheme();
  const accent = useAppearanceStore((s) => s.accent);
  const uiFont = useAppearanceStore((s) => s.uiFont);
  const toolbarVariant = useAppearanceStore((s) => s.toolbarVariant);
  const sidebarMode = useAppearanceStore((s) => s.sidebarMode);
  const setAccent = useAppearanceStore((s) => s.setAccent);
  const setUiFont = useAppearanceStore((s) => s.setUiFont);
  const setToolbarVariant = useAppearanceStore((s) => s.setToolbarVariant);
  const setSidebarMode = useAppearanceStore((s) => s.setSidebarMode);

  const open = useAppearancePanel((s) => s.open);
  const close = useAppearancePanel((s) => s.close);
  const [mounted, setMounted] = useState(false);

  // Portal needs `document` to exist; defer mount to client.
  useEffect(() => setMounted(true), []);

  // Close on Esc — small QoL so people don't have to click the X.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  // Nothing to render until the trigger flips `open` true. This keeps
  // the panel completely passive — no hidden DOM, no animation cost.
  if (!mounted || !open) return null;

  const isRu = locale === 'ru' || locale === 'uk' || locale === 'be';

  const node = (
    <div className="wp-tweaks" role="dialog" aria-label={t('appearance.title')}>
      <div className="wp-tweaks-head">
        <span style={{ flex: 1 }}>{t('appearance.title')}</span>
        <button
          type="button"
          onClick={close}
          aria-label={t('appearance.close')}
          className="grid h-6 w-6 place-items-center rounded-md text-[color:var(--ink-3)] hover:bg-[color:var(--bg-sunken)] hover:text-[color:var(--ink)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="wp-tweaks-body">
        {/* Theme */}
        <div className="wp-tweaks-field">
          <div className="wp-tweaks-label">{t('appearance.theme')}</div>
          <div className="wp-seg">
            {(['light', 'dark', 'system'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={theme === value ? 'on' : ''}
                onClick={() => setTheme(value)}
              >
                {t(`appearance.theme${value.charAt(0).toUpperCase() + value.slice(1)}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Accent — coloured swatches */}
        <div className="wp-tweaks-field">
          <div className="wp-tweaks-label">{t('appearance.accent')}</div>
          <div className="wp-swatches">
            {(Object.entries(ACCENT_PRESETS) as Array<[Accent, (typeof ACCENT_PRESETS)[Accent]]>).map(
              ([id, preset]) => (
                <button
                  key={id}
                  type="button"
                  aria-label={isRu ? preset.labelRu : preset.label}
                  title={isRu ? preset.labelRu : preset.label}
                  className={`wp-sw ${accent === id ? 'on' : ''}`}
                  style={{
                    background: `oklch(62% ${preset.chroma} ${preset.hue})`,
                  }}
                  onClick={() => setAccent(id)}
                >
                  <span className="dot" />
                </button>
              ),
            )}
          </div>
        </div>

        {/* UI font */}
        <div className="wp-tweaks-field">
          <div className="wp-tweaks-label">{t('appearance.uiFont')}</div>
          <div className="wp-seg">
            {(['sans', 'serif', 'mono'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={uiFont === value ? 'on' : ''}
                onClick={() => setUiFont(value as UiFont)}
              >
                {t(`appearance.font${value.charAt(0).toUpperCase() + value.slice(1)}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Toolbar density */}
        <div className="wp-tweaks-field">
          <div className="wp-tweaks-label">{t('appearance.toolbar')}</div>
          <div className="wp-seg">
            {(['full', 'compact', 'minimal'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={toolbarVariant === value ? 'on' : ''}
                onClick={() => setToolbarVariant(value as ToolbarVariant)}
              >
                {t(`appearance.toolbar${value.charAt(0).toUpperCase() + value.slice(1)}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar mode */}
        <div className="wp-tweaks-field">
          <div className="wp-tweaks-label">{t('appearance.sidebar')}</div>
          <div className="wp-seg">
            {(['hover', 'pinned'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={sidebarMode === value ? 'on' : ''}
                onClick={() => setSidebarMode(value as SidebarMode)}
              >
                {t(`appearance.sidebar${value.charAt(0).toUpperCase() + value.slice(1)}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
