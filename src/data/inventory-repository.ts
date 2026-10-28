import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type CollectionReference,
} from 'firebase/firestore';
import {
  parseConfiguration,
  parseFirearm,
  parseModification,
  parseSessionUsage,
  type Configuration,
  type ConfigurationInput,
  type Firearm,
  type FirearmInput,
  type Modification,
  type ModificationInput,
  type SessionUsage,
} from '@/lib/firearms';
import {
  parseAmmunition,
  parseRange,
  type Ammunition,
  type AmmunitionInput,
  type Archivable,
  type Range,
  type RangeInput,
} from '@/lib/inventory';
import { settleWrite } from '@/lib/offline-write';
import { parseTarget, type Target, type TargetInput } from '@/lib/targets';
import { firebase } from './firebase';

/** Una colección del inventario (`users/{uid}/{colección}`). Nada se borra: se archiva. */
export interface InventoryRepository<T extends Archivable, I> {
  /** Avisa con todos los elementos, archivados incluidos, cada vez que cambian. */
  subscribe(
    uid: string,
    onItems: (items: T[]) => void,
    onError: (error: unknown) => void,
  ): () => void;
  /** Id para un elemento nuevo, cuando hace falta antes de crearlo (rutas de las fotos). */
  newId(uid: string): string;
  /** Crea el elemento (con `id`, si se generó antes) y devuelve su id. */
  create(uid: string, input: I, id?: string): Promise<string>;
  update(uid: string, id: string, input: I): Promise<void>;
  setArchived(uid: string, id: string, archived: boolean): Promise<void>;
}

/** Solo lectura, en vivo. */
export interface UsageSource {
  subscribe(
    uid: string,
    onItems: (items: SessionUsage[]) => void,
    onError: (error: unknown) => void,
  ): () => void;
}

export interface InventoryRepositories {
  firearms: InventoryRepository<Firearm, FirearmInput>;
  /** Modificaciones de un arma. Devuelve siempre el mismo repositorio para el mismo arma. */
  modifications(firearmId: string): InventoryRepository<Modification, ModificationInput>;
  configurations: InventoryRepository<Configuration, ConfigurationInput>;
  ammunition: InventoryRepository<Ammunition, AmmunitionInput>;
  ranges: InventoryRepository<Range, RangeInput>;
  targets: InventoryRepository<Target, TargetInput>;
  /**
   * Arma, configuración y disparos de cada sesión, para los tiros acumulados y los contadores de
   * sesiones. Cuando existan las sesiones (paso 9) puede salir de su repositorio.
   */
  usage: UsageSource;
}

function firestoreCollection<T extends Archivable, I extends object>(
  path: (uid: string) => CollectionReference,
  parse: (id: string, data: Record<string, unknown>) => T,
): InventoryRepository<T, I> {
  return {
    subscribe(uid, onItems, onError) {
      return onSnapshot(
        path(uid),
        (snapshot) => onItems(snapshot.docs.map((d) => parse(d.id, d.data()))),
        onError,
      );
    },
    newId(uid) {
      return doc(path(uid)).id;
    },
    async create(uid, input, id) {
      const ref = id ? doc(path(uid), id) : doc(path(uid));
      await settleWrite(setDoc(ref, { ...input, archived: false }));
      return ref.id;
    },
    update(uid, id, input) {
      return settleWrite(updateDoc(doc(path(uid), id), { ...input }));
    },
    setArchived(uid, id, archived) {
      return settleWrite(updateDoc(doc(path(uid), id), { archived }));
    },
  };
}

const userCollection =
  (...segments: string[]) =>
  (uid: string) =>
    collection(firebase().db, 'users', uid, ...segments);

const modificationRepositories = new Map<
  string,
  InventoryRepository<Modification, ModificationInput>
>();

export const firebaseInventoryRepositories: InventoryRepositories = {
  firearms: firestoreCollection<Firearm, FirearmInput>(userCollection('firearms'), parseFirearm),
  modifications(firearmId) {
    let repository = modificationRepositories.get(firearmId);
    if (!repository) {
      repository = firestoreCollection<Modification, ModificationInput>(
        userCollection('firearms', firearmId, 'modifications'),
        parseModification,
      );
      modificationRepositories.set(firearmId, repository);
    }
    return repository;
  },
  configurations: firestoreCollection<Configuration, ConfigurationInput>(
    userCollection('configurations'),
    parseConfiguration,
  ),
  ammunition: firestoreCollection<Ammunition, AmmunitionInput>(
    userCollection('ammunition'),
    parseAmmunition,
  ),
  ranges: firestoreCollection<Range, RangeInput>(userCollection('ranges'), parseRange),
  targets: firestoreCollection<Target, TargetInput>(userCollection('targets'), parseTarget),
  usage: {
    subscribe(uid, onItems, onError) {
      return onSnapshot(
        userCollection('sessions')(uid),
        (snapshot) => onItems(snapshot.docs.map((d) => parseSessionUsage(d.data()))),
        onError,
      );
    },
  },
};
