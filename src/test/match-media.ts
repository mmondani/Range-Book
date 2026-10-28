// jsdom no implementa matchMedia. Este doble responde a `prefers-color-scheme: light` y al corte de
// desktop (`min-width: 1024px`), y permite simular sus cambios.

type Listener = (event: MediaQueryListEvent) => void;

const SYSTEM_LIGHT = '(prefers-color-scheme: light)';
const DESKTOP = '(min-width: 1024px)';

const matches = new Map<string, boolean>();
const listeners = new Map<string, Set<Listener>>();

function listenersOf(query: string) {
  let set = listeners.get(query);
  if (!set) listeners.set(query, (set = new Set()));
  return set;
}

function set(query: string, value: boolean) {
  matches.set(query, value);
  listenersOf(query).forEach((listener) =>
    listener({ matches: value, media: query } as MediaQueryListEvent),
  );
}

export function setSystemPrefersLight(value: boolean) {
  set(SYSTEM_LIGHT, value);
}

/** Simula una pantalla de 1024 px o más. */
export function setDesktop(value: boolean) {
  set(DESKTOP, value);
}

window.matchMedia = (query: string): MediaQueryList =>
  ({
    get matches() {
      return matches.get(query) ?? false;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: Listener) => {
      listenersOf(query).add(listener);
    },
    removeEventListener: (_type: string, listener: Listener) => {
      listenersOf(query).delete(listener);
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
