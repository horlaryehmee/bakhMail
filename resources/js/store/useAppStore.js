import { create } from 'zustand';
import { api, setCsrfToken } from '../lib/api';

const initialPayload = (() => {
  const node = document.getElementById('app');
  if (!node) return { user: null, csrfToken: '', appName: 'BakhMail', devMode: false, demoAccounts: [] };

  try {
    return JSON.parse(node.dataset.app || '{}');
  } catch {
    return { user: null, csrfToken: '', appName: 'BakhMail', devMode: false, demoAccounts: [] };
  }
})();

function resolveInitialTheme() {
  const storedTheme = window.localStorage.getItem('bakhmail-theme');
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveInitialMobileRailCollapsed() {
  return window.localStorage.getItem('bakhmail-mobile-rail-collapsed') === 'true';
}

setCsrfToken(initialPayload.csrfToken ?? '');

export const useAppStore = create((set) => ({
  appName: initialPayload.appName ?? 'BakhMail',
  devMode: Boolean(initialPayload.devMode),
  demoAccounts: initialPayload.demoAccounts ?? [],
  user: initialPayload.user
    ? {
        ...initialPayload.user,
        two_factor_enabled:
          initialPayload.user.two_factor_enabled ??
          Boolean(initialPayload.user.two_factor_secret && initialPayload.user.two_factor_confirmed_at),
      }
    : null,
  notifications: [],
  sidebarOpen: false,
  mobileRailCollapsed: resolveInitialMobileRailCollapsed(),
  theme: resolveInitialTheme(),
  setUser: (user) => set({ user }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setMobileRailCollapsed: (mobileRailCollapsed) => {
    window.localStorage.setItem('bakhmail-mobile-rail-collapsed', String(mobileRailCollapsed));
    set({ mobileRailCollapsed });
  },
  toggleMobileRailCollapsed: () =>
    set((state) => {
      const nextValue = !state.mobileRailCollapsed;
      window.localStorage.setItem('bakhmail-mobile-rail-collapsed', String(nextValue));
      return { mobileRailCollapsed: nextValue };
    }),
  setTheme: (theme) => {
    window.localStorage.setItem('bakhmail-theme', theme);
    set({ theme });
  },
  toggleTheme: () =>
    set((state) => {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem('bakhmail-theme', nextTheme);
      return { theme: nextTheme };
    }),
  fetchSession: async () => {
    const response = await api.get('/api/me');
    if (response.csrf_token) {
      setCsrfToken(response.csrf_token);
    }
    set({ user: response.user });
    return response.user;
  },
  fetchNotifications: async () => {
    const response = await api.get('/api/notifications');
    set({ notifications: response.data || [] });
    return response.data || [];
  },
  logout: async () => {
    const response = await api.post('/auth/logout', {});
    if (response.csrf_token) {
      setCsrfToken(response.csrf_token);
    }
    set({ user: null, notifications: [] });
  },
}));
