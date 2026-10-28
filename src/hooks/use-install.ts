import { useSyncExternalStore } from 'react';
import { installMethod, isIos, isStandalone, type InstallMethod } from '@/lib/install';

/** Evento de Chromium para ofrecer la instalación (no está en los tipos del DOM). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function setPrompt(event: BeforeInstallPromptEvent | null): void {
  deferredPrompt = event;
  for (const listener of listeners) listener();
}

// El navegador lo dispara una sola vez, al cargar la página: se escucha desde que se importa el
// módulo, antes de que se monte Perfil.
window.addEventListener('beforeinstallprompt', (event) => {
  // Sin el mini-infobar de Chrome: se instala desde Perfil.
  event.preventDefault();
  setPrompt(event as BeforeInstallPromptEvent);
});
window.addEventListener('appinstalled', () => setPrompt(null));

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export interface Install {
  method: InstallMethod;
  /** Abre el diálogo del navegador (solo con `method === 'prompt'`). */
  prompt(): Promise<void>;
}

/** Instalar la PWA: diálogo del navegador, instrucciones en iOS o nada si ya está instalada. */
export function useInstall(): Install {
  const event = useSyncExternalStore(subscribe, () => deferredPrompt);
  const method = installMethod({
    standalone: isStandalone(),
    ios: isIos(navigator),
    canPrompt: event !== null,
  });
  return {
    method,
    async prompt() {
      if (!event) return;
      await event.prompt();
      await event.userChoice;
      // El evento sirve una sola vez; si se rechazó, el navegador lo vuelve a ofrecer más adelante.
      setPrompt(null);
    },
  };
}
