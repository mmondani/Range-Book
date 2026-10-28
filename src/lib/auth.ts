import { DEFAULT_THEME, type ThemePreference } from '@/lib/theme';
import { DEFAULT_UNITS, type Units } from '@/lib/units';

export type SignInMethod = 'popup' | 'redirect';

export type AuthErrorKind = 'cancelled' | 'popup-blocked' | 'network' | 'unauthorized' | 'unknown';

/** Motivo por el que el login no terminó; se muestra como alerta en `/login`. */
export type AuthError = { kind: 'unauthorized'; email: string } | { kind: 'network' | 'unknown' };

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface Profile {
  displayName: string;
  photoURL: string | null;
  units: Units;
  theme: ThemePreference;
}

export const STANDALONE_QUERY = '(display-mode: standalone)';

/**
 * El popup falla en la PWA instalada (sobre todo en iOS), así que ahí se usa redirect.
 * En el navegador, el popup no saca al usuario de la página.
 */
export function chooseSignInMethod({ standalone }: { standalone: boolean }): SignInMethod {
  return standalone ? 'redirect' : 'popup';
}

const CANCELLED_CODES = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
]);

/** Clasifica errores de Firebase Auth y Firestore por su `code`. */
export function classifyAuthError(error: unknown): AuthErrorKind {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (CANCELLED_CODES.has(code)) return 'cancelled';
  if (code === 'auth/popup-blocked') return 'popup-blocked';
  if (code === 'auth/network-request-failed' || code === 'unavailable') return 'network';
  if (code === 'permission-denied') return 'unauthorized';
  return 'unknown';
}

/** Id del documento en `allowedEmails`: el email en minúsculas. */
export function allowedEmailId(email: string): string {
  return email.trim().toLowerCase();
}

/** Perfil que se crea en el primer ingreso. */
export function initialProfile(user: AuthUser): Profile {
  const fallbackName = user.email?.split('@')[0] ?? '';
  return {
    displayName: user.displayName?.trim() || fallbackName,
    photoURL: user.photoURL,
    units: DEFAULT_UNITS,
    theme: DEFAULT_THEME,
  };
}
