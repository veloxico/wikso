import { create } from 'zustand';

const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 220;
const MAX_WIDTH = 480;

interface SidebarState {
  collapsed: boolean;
  width: number;
  _hydrated: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
  setWidth: (value: number) => void;
  hydrate: () => void;
}

export { MIN_WIDTH, MAX_WIDTH };

export const useSidebarStore = create<SidebarState>((set, get) => ({
  collapsed: false,
  width: DEFAULT_WIDTH,
  _hydrated: false,
  hydrate: () => {
    if (get()._hydrated) return;
    if (typeof window === 'undefined') return;
    const storedWidth = localStorage.getItem('sidebar-width');
    set({
      collapsed: localStorage.getItem('sidebar-collapsed') === 'true',
      width: storedWidth ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Number(storedWidth))) : DEFAULT_WIDTH,
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
  setWidth: (value) => {
    const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, value));
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar-width', String(clamped));
    }
    set({ width: clamped });
  },
}));
