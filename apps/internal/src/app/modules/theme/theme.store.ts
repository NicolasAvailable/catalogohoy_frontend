import { computed } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'internal-theme';
const THEME_ATTR = 'data-theme';

type ThemeState = {
  mode: ThemeMode;
};

const readInitialMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  const prefersDark = window.matchMedia(
    '(prefers-color-scheme: dark)'
  ).matches;
  return prefersDark ? 'dark' : 'light';
};

const applyMode = (mode: ThemeMode): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(THEME_ATTR, mode);
  document.documentElement.style.colorScheme = mode;
};

export const ThemeStore = signalStore(
  { providedIn: 'root' },
  withState<ThemeState>({ mode: readInitialMode() }),
  withComputed((store) => ({
    isDark: computed(() => store.mode() === 'dark'),
  })),
  withMethods((store) => ({
    init() {
      applyMode(store.mode());
    },
    setMode(mode: ThemeMode) {
      patchState(store, { mode });
      applyMode(mode);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, mode);
      }
    },
    toggle() {
      const next: ThemeMode = store.mode() === 'dark' ? 'light' : 'dark';
      patchState(store, { mode: next });
      applyMode(next);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
    },
  }))
);
