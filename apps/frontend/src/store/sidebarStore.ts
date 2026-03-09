import { create } from 'zustand';

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed:
    typeof window !== 'undefined'
      ? localStorage.getItem('sidebar-collapsed') === 'true'
      : false,
  toggle: () =>
    set((state) => {
      const next = !state.collapsed;
      localStorage.setItem('sidebar-collapsed', String(next));
      return { collapsed: next };
    }),
  setCollapsed: (value) => {
    localStorage.setItem('sidebar-collapsed', String(value));
    set({ collapsed: value });
  },
}));
