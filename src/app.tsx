import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AuthProvider } from '@/components/auth-provider';
import { InventoryProvider } from '@/components/inventory-provider';
import { PhotoProvider } from '@/components/photo-provider';
import { ProfileProvider } from '@/components/profile-provider';
import { SessionProvider } from '@/components/session-provider';
import { ToastProvider } from '@/components/toast-provider';
import { firebaseAuthRepository, type AuthRepository } from '@/data/auth-repository';
import {
  firebaseInventoryRepositories,
  type InventoryRepositories,
} from '@/data/inventory-repository';
import { firebasePhotoRepository, type PhotoRepository } from '@/data/photo-repository';
import { firebaseProfileRepository, type ProfileRepository } from '@/data/profile-repository';
import { firebaseSessionRepository, type SessionRepository } from '@/data/session-repository';
import { useTheme } from '@/hooks/use-theme';
import { routes } from '@/routes';

export interface AppProps {
  /** Los tests pasan repositorios simulados. */
  auth?: AuthRepository;
  profiles?: ProfileRepository;
  photos?: PhotoRepository;
  inventory?: InventoryRepositories;
  sessions?: SessionRepository;
}

export function App({
  auth = firebaseAuthRepository,
  profiles = firebaseProfileRepository,
  photos = firebasePhotoRepository,
  inventory = firebaseInventoryRepositories,
  sessions = firebaseSessionRepository,
}: AppProps) {
  const [router] = useState(() => createBrowserRouter(routes));
  // Mantiene `data-theme` sincronizado (por ejemplo, si cambia el tema del sistema).
  useTheme();

  return (
    <AuthProvider auth={auth} profiles={profiles}>
      <ProfileProvider repository={profiles}>
        <PhotoProvider repository={photos}>
          <InventoryProvider repositories={inventory}>
            <SessionProvider repository={sessions}>
              <ToastProvider>
                <RouterProvider router={router} />
              </ToastProvider>
            </SessionProvider>
          </InventoryProvider>
        </PhotoProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
