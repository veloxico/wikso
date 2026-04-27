'use client';

/**
 * AppearanceTrigger — small inline button (sliders icon) that opens
 * the AppearancePanel. Designed to live next to the user-menu button
 * at the bottom of the sidebar; the panel itself slides up from
 * bottom-left, anchored to the trigger.
 *
 * Visual: a 28×28 ghost icon button that lifts on hover with the same
 * affordance as other sidebar UI buttons. Active state (panel open)
 * paints the accent-soft background so the trigger reads "currently
 * controlling something visible."
 *
 * Open-state lives in `useAppearancePanel` zustand store so the panel
 * (mounted at the dashboard layout root) and the trigger (mounted in
 * the sidebar) can communicate without prop-drilling.
 */

import { Sliders } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppearancePanel } from '@/store/appearancePanelStore';
import { cn } from '@/lib/utils';

interface AppearanceTriggerProps {
  /** Optional extra classes (e.g. for layout overrides in different sidebar contexts). */
  className?: string;
}

export function AppearanceTrigger({ className }: AppearanceTriggerProps) {
  const { t } = useTranslation();
  const open = useAppearancePanel((s) => s.open);
  const toggle = useAppearancePanel((s) => s.toggle);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('appearance.open')}
      title={t('appearance.title')}
      aria-expanded={open}
      // Match the affordance of the sidebar's user-menu trigger so the
      // two buttons read as a paired duo. We use `var(--accent-soft)`
      // for the active background to echo the sidebar item-active style.
      className={cn(
        'grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors outline-none',
        'text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50',
        'focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]',
        open && 'bg-sidebar-accent text-sidebar-accent-foreground',
        className,
      )}
    >
      <Sliders className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}
