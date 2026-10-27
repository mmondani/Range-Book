import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AuthRepository } from '@/data/auth-repository';
import type { ProfileRepository } from '@/data/profile-repository';
import { AuthContext, type AuthState } from '@/hooks/use-auth';
import { chooseSignInMethod, classifyAuthError, STANDALONE_QUERY, type AuthUser } from '@/lib/auth';

export interface AuthProviderProps {
  auth: AuthRepository;
  profiles: ProfileRepository;
  children: ReactNode;
}

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || (window.matchMedia?.(STANDALONE_QUERY).matches ?? false);
}

/**
 * Sesión de Firebase + autorización: un usuario solo queda `signedIn` si su email está en
 * `allowedEmails`. Si no lo está, se cierra la sesión de Firebase y se informa el email usado.
 */
export function AuthProvider({ auth, profiles, children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  // Usuario de Firebase actual, aunque todavía no esté verificado.
  const userRef = useRef<AuthUser | null>(null);
  // Invalida verificaciones en curso cuando cambia el usuario.
  const runRef = useRef(0);

  const verify = useCallback(
    async (user: AuthUser) => {
      const run = ++runRef.current;
      const isCurrent = () => run === runRef.current;
      setState({ status: 'loading' });

      let allowed: boolean;
      try {
        allowed = user.email !== null && (await auth.isEmailAllowed(user.email));
        if (allowed) await profiles.ensureProfile(user);
      } catch (error) {
        if (!isCurrent()) return;
        const kind = classifyAuthError(error);
        if (kind !== 'unauthorized') {
          // Se conserva el usuario de Firebase para que "Reintentar" repita la verificación.
          setState({
            status: 'signedOut',
            error: { kind: kind === 'network' ? 'network' : 'unknown' },
          });
          return;
        }
        allowed = false;
      }
      if (!isCurrent()) return;

      if (allowed) {
        setState({ status: 'signedIn', user });
        return;
      }
      setState({ status: 'signedOut', error: { kind: 'unauthorized', email: user.email ?? '' } });
      await auth.signOut().catch(() => undefined);
    },
    [auth, profiles],
  );

  const handleSignInError = useCallback(
    async (error: unknown) => {
      const kind = classifyAuthError(error);
      if (kind === 'cancelled') return;
      if (kind === 'popup-blocked') {
        try {
          await auth.signIn('redirect');
        } catch {
          setState({ status: 'signedOut', error: { kind: 'unknown' } });
        }
        return;
      }
      setState({
        status: 'signedOut',
        error: { kind: kind === 'network' ? 'network' : 'unknown' },
      });
    },
    [auth],
  );

  useEffect(() => {
    const unsubscribe = auth.onUserChanged((user) => {
      userRef.current = user;
      if (user) {
        void verify(user);
        return;
      }
      runRef.current++;
      // Si ya estaba fuera (por ejemplo, con la alerta de no autorizado), se conserva el error.
      setState((prev) => (prev.status === 'signedOut' ? prev : { status: 'signedOut' }));
    });
    auth.completeRedirect().catch(handleSignInError);
    return unsubscribe;
  }, [auth, verify, handleSignInError]);

  const signIn = useCallback(async () => {
    setState({ status: 'signedOut' });
    try {
      // Si quedó un usuario sin verificar (por un error de red), se empieza de cero.
      if (userRef.current) await auth.signOut();
      await auth.signIn(chooseSignInMethod({ standalone: isStandalone() }));
    } catch (error) {
      await handleSignInError(error);
    }
  }, [auth, handleSignInError]);

  const signOut = useCallback(async () => {
    setState({ status: 'signedOut' });
    await auth.signOut();
  }, [auth]);

  const retry = useCallback(async () => {
    if (userRef.current) await verify(userRef.current);
    else await signIn();
  }, [verify, signIn]);

  const value = useMemo(() => ({ state, signIn, signOut, retry }), [state, signIn, signOut, retry]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
