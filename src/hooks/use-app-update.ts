import { useSyncExternalStore } from 'react';

// Aplica la versión nueva del service worker; `null` si no hay ninguna esperando.
let applyUpdate: (() => void) | null = null;
const listeners = new Set<() => void>();

function setUpdate(apply: (() => void) | null): void {
  applyUpdate = apply;
  for (const listener of listeners) listener();
}

/**
 * Registra el service worker (solo en producción). Una versión nueva queda esperando hasta que el
 * usuario la acepte (`useAppUpdate`) o hasta que se cierre la app, para no recargar en medio de un
 * formulario. Busca versiones nuevas cada vez que la app vuelve a primer plano.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  let reloading = false;

  window.addEventListener('load', async () => {
    const registration = await navigator.serviceWorker.register('/sw.js');

    const offer = (worker: ServiceWorker) =>
      setUpdate(() => {
        reloading = true;
        worker.postMessage({ type: 'SKIP_WAITING' });
      });
    // Sin `controller` es la primera instalación: no hay nada que actualizar.
    if (registration.waiting && navigator.serviceWorker.controller) offer(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
      });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => {});
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) window.location.reload();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Cómo pasar a la versión nueva de la app (recarga la página), o `null` si no hay. */
export function useAppUpdate(): (() => void) | null {
  return useSyncExternalStore(subscribe, () => applyUpdate);
}
