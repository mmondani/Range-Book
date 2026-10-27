import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import { SplashScreen } from './splash-screen';

/** Guard de rutas: sin un usuario autorizado, manda a `/login` recordando a dónde iba. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') return <SplashScreen />;
  if (state.status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
