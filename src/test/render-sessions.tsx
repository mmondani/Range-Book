import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AuthProvider } from '@/components/auth-provider';
import { InventoryProvider } from '@/components/inventory-provider';
import { PhotoProvider } from '@/components/photo-provider';
import { SessionProvider } from '@/components/session-provider';
import { ToastProvider } from '@/components/toast-provider';
import type { SessionRepository } from '@/data/session-repository';
import type { Session } from '@/lib/sessions';
import { routes } from '@/routes';
import { ANA, createFakeAuth } from './fake-auth';
import { createFakeInventory } from './fake-inventory';
import { createFakePhotos } from './fake-photos';
import { createFakeSessions } from './fake-sessions';

export interface RenderSessionsOptions {
  sessions?: Session[];
  /** Reemplaza el repositorio de sesiones (por ejemplo, uno que nunca carga). */
  repository?: SessionRepository;
}

/** Monta la app en `path` con repositorios simulados, para los tests de las pantallas de sesiones. */
export function renderSessions(path: string, { sessions, repository }: RenderSessionsOptions = {}) {
  const { auth, profiles } = createFakeAuth({ initialUser: ANA });
  const inventory = createFakeInventory();
  const photos = createFakePhotos();
  const fakeSessions = createFakeSessions(sessions);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <AuthProvider auth={auth} profiles={profiles}>
      <PhotoProvider repository={photos.repository}>
        <InventoryProvider repositories={inventory.repositories}>
          <SessionProvider repository={repository ?? fakeSessions.repository}>
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </SessionProvider>
        </InventoryProvider>
      </PhotoProvider>
    </AuthProvider>,
  );
  return {
    ...view,
    router,
    sessions: fakeSessions.repository,
    sessionItems: fakeSessions.items,
    photos: photos.repository,
  };
}
