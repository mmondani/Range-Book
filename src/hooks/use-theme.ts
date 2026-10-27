import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  DEFAULT_THEME,
  parseThemePreference,
  resolveTheme,
  SYSTEM_LIGHT_QUERY,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme';

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function readPreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

function systemMedia(): MediaQueryList | undefined {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia(SYSTEM_LIGHT_QUERY)
    : undefined;
}

function readSystemPrefersLight(): boolean {
  return systemMedia()?.matches ?? false;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = systemMedia();
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) listener();
  };
  media?.addEventListener('change', listener);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    media?.removeEventListener('change', listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function applyTheme(theme: ResolvedTheme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

export function useTheme() {
  const preference = useSyncExternalStore(subscribe, readPreference);
  const systemPrefersLight = useSyncExternalStore(subscribe, readSystemPrefersLight);
  const resolved = resolveTheme(preference, systemPrefersLight);

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Sin almacenamiento: el tema se aplica igual mientras dure la página.
    }
    applyTheme(resolveTheme(next, readSystemPrefersLight()));
    notify();
  }, []);

  return { preference, resolved, setPreference };
}
