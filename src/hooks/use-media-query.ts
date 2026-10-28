import { useCallback, useSyncExternalStore } from 'react';

/** Mismo corte que el CSS: sidebar y tablas desde 1024 px. */
export const DESKTOP_QUERY = '(min-width: 1024px)';

function media(query: string): MediaQueryList | undefined {
  return typeof window.matchMedia === 'function' ? window.matchMedia(query) : undefined;
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      const list = media(query);
      list?.addEventListener('change', listener);
      return () => list?.removeEventListener('change', listener);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => media(query)?.matches ?? false);
}

/**
 * Para cuando mobile y desktop cambian la estructura (lista o tabla) y no solo el estilo.
 * Para el resto alcanza con el CSS.
 */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
