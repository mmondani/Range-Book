import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  ALLOWED,
  createTestEnvironment,
  NOT_ALLOWED,
  OTHER_ALLOWED,
  seedAllowedEmails,
  signedIn,
} from './test-environment';

const JPEG = { contentType: 'image/jpeg' };
const photo = () => new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const path = (uid: string) => `users/${uid}/sessions/s1/foto.jpg`;

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnvironment();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seedAllowedEmails(env);
  await env.withSecurityRulesDisabled(async (context) => {
    const storage = context.storage();
    await uploadBytes(ref(storage, path(ALLOWED.uid)), photo(), JPEG);
    await uploadBytes(ref(storage, path(OTHER_ALLOWED.uid)), photo(), JPEG);
  });
});

describe('storage', () => {
  it('un usuario autorizado sube y lee sus fotos', async () => {
    const storage = signedIn(env, ALLOWED).storage();
    await assertSucceeds(getBytes(ref(storage, path(ALLOWED.uid))));
    await assertSucceeds(
      uploadBytes(ref(storage, `users/${ALLOWED.uid}/firearms/f1/nueva.jpg`), photo(), JPEG),
    );
  });

  it('solo acepta imágenes', async () => {
    const storage = signedIn(env, ALLOWED).storage();
    await assertFails(
      uploadBytes(ref(storage, `users/${ALLOWED.uid}/firearms/f1/notas.txt`), photo(), {
        contentType: 'text/plain',
      }),
    );
  });

  it('el usuario A no lee ni escribe las fotos de B', async () => {
    const storage = signedIn(env, ALLOWED).storage();
    await assertFails(getBytes(ref(storage, path(OTHER_ALLOWED.uid))));
    await assertFails(uploadBytes(ref(storage, path(OTHER_ALLOWED.uid)), photo(), JPEG));
  });

  it('un usuario no autorizado no lee ni sube nada', async () => {
    const storage = signedIn(env, NOT_ALLOWED).storage();
    await assertFails(getBytes(ref(storage, path(ALLOWED.uid))));
    await assertFails(uploadBytes(ref(storage, path(NOT_ALLOWED.uid)), photo(), JPEG));
  });

  it('sin sesión no se lee nada', async () => {
    const storage = env.unauthenticatedContext().storage();
    await assertFails(getBytes(ref(storage, path(ALLOWED.uid))));
  });
});
