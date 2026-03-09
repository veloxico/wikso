import { create } from 'zustand';

interface SidebarState {
  collapsed: boolean;
  _hydrated: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
  hydrate: () => void;
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  collapsed: false,
  _hydrated: false,
  hydrate: () => {
    if (get()._hydrated) return;
    if (typeof window === 'undefined') return;
    set({
      collapsed: localStorage.getItem('sidebar-collapsed') === 'true',
      _hydrated: true,
    });
  },
  toggle: () =>
    set((state) => {
      const next = !state.collapsed;
      if (typeof window !== 'undefined') {
        localStorage.setItem('sidebar-collapsed', String(next));
      }
      return { collapsed: next };
    }),
  setCollapsed: (value) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar-collapsed', String(value));
    }
    set({ collapsed: value });
  },
}));
