import { createContext, useContext } from 'react';
import type { AuthError, AuthUser } from '@/lib/auth';

export type AuthState =
  /** Al iniciar, o mientras se verifica que el email esté autorizado. */
  | { status: 'loading' }
  | { status: 'signedOut'; error?: AuthError }
  | { status: 'signedIn'; user: AuthUser };

export interface AuthContextValue {
  state: AuthState;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Reintenta lo que falló: la verificación del usuario actual o el login. */
  retry: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth necesita un AuthProvider');
  return context;
}

/** Usuario autorizado, o `null` si no hay sesión (o no hay `AuthProvider`). */
export function useCurrentUser(): AuthUser | null {
  const state = useContext(AuthContext)?.state;
  return state?.status === 'signedIn' ? state.user : null;
}
