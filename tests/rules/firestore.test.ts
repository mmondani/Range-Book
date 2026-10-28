import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  ALLOWED,
  createTestEnvironment,
  NOT_ALLOWED,
  OTHER_ALLOWED,
  seedAllowedEmails,
  signedIn,
} from './test-environment';

const PROFILE = { displayName: 'Ana Gómez', photoURL: null, units: 'mm', theme: 'dark' };
const AMMUNITION = { brand: 'CCI', model: 'Standard Velocity', description: '', archived: false };
const RANGE = { name: 'Club', address: '', archived: false };

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnvironment();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedAllowedEmails(env);
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', ALLOWED.uid), PROFILE);
    await setDoc(doc(db, 'users', ALLOWED.uid, 'firearms', 'glock'), { brand: 'Glock' });
    await setDoc(doc(db, 'users', OTHER_ALLOWED.uid), { ...PROFILE, displayName: 'Beto' });
    await setDoc(doc(db, 'users', OTHER_ALLOWED.uid, 'firearms', 'cz'), { brand: 'CZ' });
  });
});

describe('allowedEmails', () => {
  it('cada usuario puede consultar su propio email, esté o no autorizado', async () => {
    const allowed = signedIn(env, ALLOWED).firestore();
    const notAllowed = signedIn(env, NOT_ALLOWED).firestore();
    await assertSucceeds(getDoc(doc(allowed, 'allowedEmails', ALLOWED.email)));
    await assertSucceeds(getDoc(doc(notAllowed, 'allowedEmails', NOT_ALLOWED.email)));
  });

  it('compara el email sin distinguir mayúsculas', async () => {
    const db = signedIn(env, { uid: ALLOWED.uid, email: 'Ana@Example.com' }).firestore();
    await assertSucceeds(getDoc(doc(db, 'allowedEmails', ALLOWED.email)));
    await assertSucceeds(getDoc(doc(db, 'users', ALLOWED.uid)));
  });

  it('nadie puede consultar el email de otro ni listar la colección', async () => {
    const db = signedIn(env, ALLOWED).firestore();
    await assertFails(getDoc(doc(db, 'allowedEmails', OTHER_ALLOWED.email)));
    await assertFails(getDocs(collection(db, 'allowedEmails')));
    const anonymous = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonymous, 'allowedEmails', ALLOWED.email)));
  });

  it('nadie puede escribirla, ni siquiera un usuario autorizado', async () => {
    const allowed = signedIn(env, ALLOWED).firestore();
    const notAllowed = signedIn(env, NOT_ALLOWED).firestore();
    await assertFails(setDoc(doc(notAllowed, 'allowedEmails', NOT_ALLOWED.email), {}));
    await assertFails(setDoc(doc(allowed, 'allowedEmails', 'amigo@example.com'), {}));
    await assertFails(setDoc(doc(allowed, 'allowedEmails', ALLOWED.email), { admin: true }));
    await assertFails(deleteDoc(doc(allowed, 'allowedEmails', ALLOWED.email)));
  });
});

describe('users', () => {
  it('un usuario autorizado lee y escribe sus datos', async () => {
    const db = signedIn(env, ALLOWED).firestore();
    await assertSucceeds(getDoc(doc(db, 'users', ALLOWED.uid)));
    await assertSucceeds(getDocs(collection(db, 'users', ALLOWED.uid, 'firearms')));
    await assertSucceeds(setDoc(doc(db, 'users', ALLOWED.uid, 'ranges', 'club'), RANGE));
    await assertSucceeds(deleteDoc(doc(db, 'users', ALLOWED.uid, 'firearms', 'glock')));
  });

  it('un usuario no autorizado no lee ni escribe nada, ni siquiera bajo su uid', async () => {
    const db = signedIn(env, NOT_ALLOWED).firestore();
    await assertFails(getDoc(doc(db, 'users', NOT_ALLOWED.uid)));
    await assertFails(setDoc(doc(db, 'users', NOT_ALLOWED.uid), PROFILE));
    await assertFails(setDoc(doc(db, 'users', NOT_ALLOWED.uid, 'firearms', 'x'), {}));
    await assertFails(getDoc(doc(db, 'users', ALLOWED.uid)));
    await assertFails(getDocs(collection(db, 'users', ALLOWED.uid, 'firearms')));
  });

  it('sin sesión no se lee nada', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'users', ALLOWED.uid)));
    await assertFails(getDocs(collection(db, 'users', ALLOWED.uid, 'firearms')));
  });

  it('con el email sin verificar no se lee nada', async () => {
    const db = signedIn(env, ALLOWED, { emailVerified: false }).firestore();
    await assertFails(getDoc(doc(db, 'users', ALLOWED.uid)));
  });

  it('el usuario A no lee ni escribe los datos de B', async () => {
    const db = signedIn(env, ALLOWED).firestore();
    await assertFails(getDoc(doc(db, 'users', OTHER_ALLOWED.uid)));
    await assertFails(getDoc(doc(db, 'users', OTHER_ALLOWED.uid, 'firearms', 'cz')));
    await assertFails(getDocs(collection(db, 'users', OTHER_ALLOWED.uid, 'firearms')));
    await assertFails(setDoc(doc(db, 'users', OTHER_ALLOWED.uid, 'firearms', 'cz'), {}));
    await assertFails(setDoc(doc(db, 'users', OTHER_ALLOWED.uid), PROFILE));
  });

  it('el perfil se crea con los campos válidos y no se puede borrar', async () => {
    await env.clearFirestore();
    await seedAllowedEmails(env);
    const db = signedIn(env, ALLOWED).firestore();
    const ref = doc(db, 'users', ALLOWED.uid);
    await assertFails(setDoc(ref, { ...PROFILE, units: 'yd' }));
    await assertFails(setDoc(ref, { ...PROFILE, theme: 'azul' }));
    await assertFails(setDoc(ref, { ...PROFILE, admin: true }));
    await assertSucceeds(setDoc(ref, PROFILE));
    await assertSucceeds(setDoc(ref, { ...PROFILE, units: 'in', theme: 'system' }));
    await assertFails(deleteDoc(ref));
  });

  it('las preferencias se actualizan por separado, solo con valores válidos', async () => {
    const db = signedIn(env, ALLOWED).firestore();
    const ref = doc(db, 'users', ALLOWED.uid);
    await assertSucceeds(updateDoc(ref, { units: 'in' }));
    await assertSucceeds(updateDoc(ref, { theme: 'light' }));
    await assertFails(updateDoc(ref, { units: 'yd' }));
    await assertFails(updateDoc(ref, { theme: 'azul' }));
    await assertFails(updateDoc(ref, { admin: true }));
    await assertFails(updateDoc(doc(db, 'users', OTHER_ALLOWED.uid), { theme: 'light' }));
  });
});

describe('inventario: munición y polígonos', () => {
  const ammo = (db: ReturnType<ReturnType<typeof signedIn>['firestore']>, id = 'cci') =>
    doc(db, 'users', ALLOWED.uid, 'ammunition', id);
  const range = (db: ReturnType<ReturnType<typeof signedIn>['firestore']>, id = 'club') =>
    doc(db, 'users', ALLOWED.uid, 'ranges', id);

  it('se crean y editan con los campos válidos', async () => {
    const db = signedIn(env, ALLOWED).firestore();
    await assertSucceeds(setDoc(ammo(db), AMMUNITION));
    await assertSucceeds(updateDoc(ammo(db), { description: '40 gr, plomo' }));
    await assertSucceeds(setDoc(range(db), { ...RANGE, address: 'Ruta 2 km 40' }));
    await assertSucceeds(getDocs(collection(db, 'users', ALLOWED.uid, 'ammunition')));
  });

  it('rechaza campos faltantes, vacíos, de otro tipo, demasiado largos o de más', async () => {
    const db = signedIn(env, ALLOWED).firestore();
    await assertFails(setDoc(ammo(db), { ...AMMUNITION, brand: '' }));
    await assertFails(setDoc(ammo(db), { brand: 'CCI', model: 'SV', archived: false }));
    await assertFails(setDoc(ammo(db), { ...AMMUNITION, archived: 'no' }));
    await assertFails(setDoc(ammo(db), { ...AMMUNITION, model: 'x'.repeat(101) }));
    await assertFails(setDoc(ammo(db), { ...AMMUNITION, price: 10 }));
    await assertFails(setDoc(range(db), { ...RANGE, name: '' }));
    await assertFails(setDoc(range(db), { ...RANGE, address: 'x'.repeat(501) }));
    await assertFails(setDoc(range(db), { name: 'Club', archived: false }));
  });

  it('se archivan y restauran, pero no se borran', async () => {
    const db = signedIn(env, ALLOWED).firestore();
    await assertSucceeds(setDoc(range(db), RANGE));
    await assertSucceeds(updateDoc(range(db), { archived: true }));
    await assertSucceeds(updateDoc(range(db), { archived: false }));
    await assertFails(deleteDoc(range(db)));
    await assertSucceeds(setDoc(ammo(db), AMMUNITION));
    await assertFails(deleteDoc(ammo(db)));
  });

  it('el usuario A no lee ni escribe el inventario de B', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', OTHER_ALLOWED.uid, 'ranges', 'x'), RANGE);
    });
    const db = signedIn(env, ALLOWED).firestore();
    await assertFails(getDoc(doc(db, 'users', OTHER_ALLOWED.uid, 'ranges', 'x')));
    await assertFails(getDocs(collection(db, 'users', OTHER_ALLOWED.uid, 'ammunition')));
    await assertFails(setDoc(doc(db, 'users', OTHER_ALLOWED.uid, 'ammunition', 'y'), AMMUNITION));
  });
});
