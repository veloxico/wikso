import { create } from 'zustand';

/**
 * Open-state store for the floating Appearance ("Tweaks") panel.
 *
 * The panel and its trigger live in different parts of the React tree —
 * the panel is mounted at the dashboard layout root (so it survives
 * route changes via Portal), while the trigger sits inside the sidebar
 * next to the user-menu button. This tiny zustand store is the bridge.
 *
 * Usage:
 *   const open = useAppearancePanel((s) => s.open);
 *   const toggle = useAppearancePanel((s) => s.toggle);
 *
 * No persistence — appearance settings themselves are persisted by
 * `appearanceStore`; whether the panel is open at any given moment is
 * ephemeral session state.
 */
interface AppearancePanelState {
  open: boolean;
  toggle: () => void;
  setOpen: (value: boolean) => void;
  close: () => void;
}

export const useAppearancePanel = create<AppearancePanelState>((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  setOpen: (value) => set({ open: value }),
  close: () => set({ open: false }),
}));
