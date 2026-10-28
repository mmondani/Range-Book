import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

// Los emuladores los levanta `pnpm test:rules` (firebase emulators:exec), que además define
// FIRESTORE_EMULATOR_HOST y FIREBASE_STORAGE_EMULATOR_HOST.
export const PROJECT_ID = 'demo-rangebook';

export const ALLOWED = { uid: 'ana', email: 'ana@example.com' };
export const OTHER_ALLOWED = { uid: 'beto', email: 'beto@example.com' };
export const NOT_ALLOWED = { uid: 'intruso', email: 'intruso@example.com' };

export function createTestEnvironment(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  });
}

/** Carga los emails autorizados salteando las reglas, como se hace desde la consola. */
export async function seedAllowedEmails(env: RulesTestEnvironment) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'allowedEmails', ALLOWED.email), {});
    await setDoc(doc(db, 'allowedEmails', OTHER_ALLOWED.email), {});
  });
}

export function signedIn(
  env: RulesTestEnvironment,
  user: { uid: string; email: string },
  { emailVerified = true }: { emailVerified?: boolean } = {},
) {
  return env.authenticatedContext(user.uid, {
    email: user.email,
    email_verified: emailVerified,
  });
}
