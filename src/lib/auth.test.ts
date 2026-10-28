import { describe, expect, it } from 'vitest';
import { allowedEmailId, chooseSignInMethod, classifyAuthError, initialProfile } from './auth';

describe('chooseSignInMethod', () => {
  it('usa popup en el navegador y redirect en la PWA instalada', () => {
    expect(chooseSignInMethod({ standalone: false })).toBe('popup');
    expect(chooseSignInMethod({ standalone: true })).toBe('redirect');
  });
});

describe('classifyAuthError', () => {
  it.each([
    ['auth/popup-closed-by-user', 'cancelled'],
    ['auth/cancelled-popup-request', 'cancelled'],
    ['auth/user-cancelled', 'cancelled'],
    ['auth/popup-blocked', 'popup-blocked'],
    ['auth/network-request-failed', 'network'],
    ['unavailable', 'network'],
    ['permission-denied', 'unauthorized'],
    ['auth/internal-error', 'unknown'],
  ])('%s → %s', (code, kind) => {
    expect(classifyAuthError({ code })).toBe(kind);
  });

  it('un error sin código es desconocido', () => {
    expect(classifyAuthError(new Error('boom'))).toBe('unknown');
    expect(classifyAuthError(undefined)).toBe('unknown');
  });
});

describe('allowedEmailId', () => {
  it('pasa el email a minúsculas y le saca los espacios', () => {
    expect(allowedEmailId(' Ana.Gomez@Gmail.com ')).toBe('ana.gomez@gmail.com');
  });
});

describe('initialProfile', () => {
  const user = {
    uid: 'u1',
    email: 'ana@example.com',
    displayName: 'Ana Gómez',
    photoURL: 'https://example.com/ana.jpg',
  };

  it('toma nombre y foto de la cuenta, con mm y tema oscuro por defecto', () => {
    expect(initialProfile(user)).toEqual({
      displayName: 'Ana Gómez',
      photoURL: 'https://example.com/ana.jpg',
      units: 'mm',
      theme: 'dark',
    });
  });

  it('sin nombre usa la parte local del email', () => {
    expect(initialProfile({ ...user, displayName: null, photoURL: null })).toMatchObject({
      displayName: 'ana',
      photoURL: null,
    });
  });
});
