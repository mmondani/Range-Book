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
const FIREARM = {
  brand: 'Glock',
  model: '17 Gen5',
  caliber: '9×19 mm',
  purchaseDate: '2023-03-14',
  purchasePlace: 'Armería Centro',
  priorShots: 1200,
  photos: ['users/ana/firearms/glock/a.jpg'],
  archived: false,
};
const MODIFICATION = { brand: 'Holosun', model: '507C', comments: '', archived: false };
const CONFIGURATION = {
  name: 'IPSC',
  firearmId: 'glock',
  modificationIds: ['holosun'],
  archived: false,
};

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
    await setDoc(doc(db, 'users', ALLOWED.uid, 'firearms', 'glock'), FIREARM);
    await setDoc(doc(db, 'users', ALLOWED.uid, 'sessions', 's1'), { notes: '' });
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
    await assertSucceeds(deleteDoc(doc(db, 'users', ALLOWED.uid, 'sessions', 's1')));
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

describe('inventario: armas, modificaciones y configuraciones', () => {
  type Db = ReturnType<ReturnType<typeof signedIn>['firestore']>;
  const firearm = (db: Db, id = 'glock') => doc(db, 'users', ALLOWED.uid, 'firearms', id);
  const modification = (db: Db, id = 'holosun') =>
    doc(db, 'users', ALLOWED.uid, 'firearms', 'glock', 'modifications', id);
  const configuration = (db: Db, id = 'ipsc') =>
    doc(db, 'users', ALLOWED.uid, 'configurations', id);

  it('se crean y editan con los campos válidos', async () => {
    const db = signedIn(env, ALLOWED).firestore();
    await assertSucceeds(setDoc(firearm(db, 'cz'), { ...FIREARM, purchaseDate: null, photos: [] }));
    await assertSucceeds(updateDoc(firearm(db), { priorShots: 1500, photos: [] }));
    await assertSucceeds(setDoc(modification(db), MODIFICATION));
    await assertSucceeds(updateDoc(modification(db), { comments: 'Red dot' }));
    await assertSucceeds(setDoc(configuration(db), CONFIGURATION));
    await assertSucceeds(updateDoc(configuration(db), { modificationIds: ['holosun', 'zev'] }));
    await assertSucceeds(getDocs(collection(db, 'users', ALLOWED.uid, 'configurations')));
    await assertSucceeds(
      getDocs(collection(db, 'users', ALLOWED.uid, 'firearms', 'glock', 'modifications')),
    );
  });

  it('el arma rechaza campos faltantes, vacíos, inválidos o de más', async () => {
    const db = signedIn(env, ALLOWED).firestore();
    const ref = firearm(db, 'x');
    await assertFails(setDoc(ref, { ...FIREARM, caliber: '' }));
    await assertFails(setDoc(ref, { ...FIREARM, priorShots: -1 }));
    await assertFails(setDoc(ref, { ...FIREARM, priorShots: 12.5 }));
    await assertFails(setDoc(ref, { ...FIREARM, priorShots: 10000001 }));
    await assertFails(setDoc(ref, { ...FIREARM, purchaseDate: '14/03/2023' }));
    await assertFails(setDoc(ref, { ...FIREARM, photos: 'a.jpg' }));
    await assertFails(setDoc(ref, { ...FIREARM, photos: Array.from({ length: 21 }, String) }));
    await assertFails(setDoc(ref, { ...FIREARM, serial: '123' }));
    const { photos, ...withoutPhotos } = FIREARM;
    void photos;
    await assertFails(setDoc(ref, withoutPhotos));
  });

  it('la modificación y la configuración validan sus campos', async () => {
    const db = signedIn(env, ALLOWED).firestore();
    await assertFails(setDoc(modification(db), { ...MODIFICATION, brand: '' }));
    await assertFails(setDoc(modification(db), { ...MODIFICATION, comments: 'x'.repeat(501) }));
    await assertFails(setDoc(configuration(db), { ...CONFIGURATION, name: '' }));
    await assertFails(setDoc(configuration(db), { ...CONFIGURATION, modificationIds: [] }));
    await assertFails(setDoc(configuration(db), { ...CONFIGURATION, modificationIds: 'holosun' }));
  });

  it('la configuración tiene que apuntar a un arma propia', async () => {
    const db = signedIn(env, ALLOWED).firestore();
    await assertFails(setDoc(configuration(db), { ...CONFIGURATION, firearmId: 'nada' }));
    // `cz` es un arma de B.
    await assertFails(setDoc(configuration(db), { ...CONFIGURATION, firearmId: 'cz' }));
  });

  it('se archivan y restauran, pero no se borran', async () => {
    const db = signedIn(env, ALLOWED).firestore();
    await assertSucceeds(updateDoc(firearm(db), { archived: true }));
    await assertSucceeds(updateDoc(firearm(db), { archived: false }));
    await assertFails(deleteDoc(firearm(db)));
    await assertSucceeds(setDoc(modification(db), MODIFICATION));
    await assertSucceeds(updateDoc(modification(db), { archived: true }));
    await assertFails(deleteDoc(modification(db)));
    await assertSucceeds(setDoc(configuration(db), CONFIGURATION));
    await assertFails(deleteDoc(configuration(db)));
  });

  it('el usuario A no lee ni escribe las armas de B', async () => {
    const db = signedIn(env, ALLOWED).firestore();
    const other = (...path: string[]) => doc(db, 'users', OTHER_ALLOWED.uid, ...path);
    await assertFails(getDoc(other('firearms', 'cz')));
    await assertFails(setDoc(other('firearms', 'cz', 'modifications', 'm'), MODIFICATION));
    await assertFails(setDoc(other('configurations', 'c'), { ...CONFIGURATION, firearmId: 'cz' }));
  });
});
