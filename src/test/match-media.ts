// jsdom no implementa matchMedia. Este doble responde a `prefers-color-scheme: light` y permite
// simular el cambio del tema del sistema.

type Listener = (event: MediaQueryListEvent) => void;

let prefersLight = false;
const listeners = new Set<Listener>();

export function setSystemPrefersLight(value: boolean) {
  prefersLight = value;
  listeners.forEach((listener) =>
    listener({ matches: value, media: '(prefers-color-scheme: light)' } as MediaQueryListEvent),
  );
}

window.matchMedia = (query: string): MediaQueryList => {
  const isLightQuery = query === '(prefers-color-scheme: light)';
  return {
    get matches() {
      return isLightQuery && prefersLight;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: Listener) => {
      if (isLightQuery) listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: Listener) => {
      listeners.delete(listener);
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
};
