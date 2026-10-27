import { vi } from 'vitest';
import type { AuthRepository } from '@/data/auth-repository';
import type { ProfileRepository } from '@/data/profile-repository';
import { initialProfile, type AuthUser, type Profile } from '@/lib/auth';
import type { ProfileSummary } from '@/lib/profile';

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
  /** Perfil guardado en Firestore de cualquier usuario que ingrese (sobre el inicial). */
  profile?: Partial<Profile>;
  summary?: ProfileSummary;
}

/** Doble de Firebase Auth: notifica a los observadores solo si cambia el uid, como Firebase. */
export function createFakeAuth({
  initialUser = null,
  signInAs = ANA,
  allowedEmails = [ANA.email!],
  profile,
  summary = { sessions: 0, shots: 0, firearms: 0 },
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

  const profiles = createFakeProfiles({ profile, summary });

  return { auth, profiles, setUser };
}

/** Doble de `users/{uid}` en memoria, con avisos en vivo como `onSnapshot`. */
function createFakeProfiles({
  profile,
  summary,
}: {
  profile?: Partial<Profile>;
  summary: ProfileSummary;
}) {
  const stored = new Map<string, Profile>();
  const listeners = new Map<string, Set<(profile: Profile | null) => void>>();

  function listenersOf(uid: string) {
    let set = listeners.get(uid);
    if (!set) listeners.set(uid, (set = new Set()));
    return set;
  }

  function save(uid: string, next: Profile) {
    stored.set(uid, next);
    listenersOf(uid).forEach((listener) => listener(next));
  }

  return {
    ensureProfile: vi.fn(async (user: AuthUser) => {
      if (!stored.has(user.uid)) save(user.uid, { ...initialProfile(user), ...profile });
    }),
    subscribeProfile: vi.fn((uid: string, onProfile: (profile: Profile | null) => void) => {
      listenersOf(uid).add(onProfile);
      onProfile(stored.get(uid) ?? null);
      return () => listenersOf(uid).delete(onProfile);
    }),
    updatePreferences: vi.fn(async (uid: string, preferences: Partial<Profile>) => {
      const current = stored.get(uid);
      if (current) save(uid, { ...current, ...preferences });
    }),
    subscribeSummary: vi.fn<ProfileRepository['subscribeSummary']>((_uid, onSummary) => {
      onSummary(summary);
      return () => undefined;
    }),
    /** Simula un cambio hecho desde otro dispositivo. */
    setRemote(uid: string, preferences: Partial<Profile>) {
      const current = stored.get(uid);
      if (current) save(uid, { ...current, ...preferences });
    },
  } satisfies ProfileRepository & Record<string, unknown>;
}

/** Promesa que nunca se resuelve, para ver estados de carga. */
export function never<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}
