import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AuthProvider } from '@/components/auth-provider';
import { ProfileProvider } from '@/components/profile-provider';
import { ToastProvider } from '@/components/toast-provider';
import { firebaseAuthRepository, type AuthRepository } from '@/data/auth-repository';
import { firebaseProfileRepository, type ProfileRepository } from '@/data/profile-repository';
import { useTheme } from '@/hooks/use-theme';
import { routes } from '@/routes';

export interface AppProps {
  /** Los tests pasan repositorios simulados. */
  auth?: AuthRepository;
  profiles?: ProfileRepository;
}

export function App({
  auth = firebaseAuthRepository,
  profiles = firebaseProfileRepository,
}: AppProps) {
  const [router] = useState(() => createBrowserRouter(routes));
  // Mantiene `data-theme` sincronizado (por ejemplo, si cambia el tema del sistema).
  useTheme();

  return (
    <AuthProvider auth={auth} profiles={profiles}>
      <ProfileProvider repository={profiles}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
