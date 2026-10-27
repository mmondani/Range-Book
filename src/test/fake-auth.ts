import { vi } from 'vitest';
import type { AuthRepository } from '@/data/auth-repository';
import type { ProfileRepository } from '@/data/profile-repository';
import type { AuthUser } from '@/lib/auth';

export const ANA: AuthUser = {
  uid: 'ana',
  email: 'ana@example.com',
  displayName: 'Ana Gómez',
  photoURL: null,
};

export const INTRUDER: AuthUser = {
  uid: 'intruso',
  email: 'intruso@example.com',
  displayName: 'Intruso',
  photoURL: null,
};

export interface FakeAuthOptions {
  /** Usuario con sesión al abrir la app. */
  initialUser?: AuthUser | null;
  /** Usuario que elige el selector de cuentas de Google al hacer login. */
  signInAs?: AuthUser;
  allowedEmails?: string[];
}

/** Doble de Firebase Auth: notifica a los observadores solo si cambia el uid, como Firebase. */
export function createFakeAuth({
  initialUser = null,
  signInAs = ANA,
  allowedEmails = [ANA.email!],
}: FakeAuthOptions = {}) {
  let current = initialUser;
  const listeners = new Set<(user: AuthUser | null) => void>();

  function setUser(user: AuthUser | null) {
    if (user?.uid === current?.uid) return;
    current = user;
    listeners.forEach((listener) => listener(user));
  }

  const auth = {
    onUserChanged: vi.fn((callback: (user: AuthUser | null) => void) => {
      listeners.add(callback);
      callback(current);
      return () => listeners.delete(callback);
    }),
    signIn: vi.fn(async () => setUser(signInAs)),
    completeRedirect: vi.fn(async () => undefined),
    signOut: vi.fn(async () => setUser(null)),
    isEmailAllowed: vi.fn(async (email: string) => allowedEmails.includes(email)),
  } satisfies AuthRepository;

  const profiles = {
    ensureProfile: vi.fn(async () => undefined),
  } satisfies ProfileRepository;

  return { auth, profiles, setUser };
}

/** Promesa que nunca se resuelve, para ver estados de carga. */
export function never<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}
