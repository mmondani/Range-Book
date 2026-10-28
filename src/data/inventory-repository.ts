import { collection, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import {
  parseAmmunition,
  parseRange,
  type Ammunition,
  type AmmunitionInput,
  type Archivable,
  type Range,
  type RangeInput,
} from '@/lib/inventory';
import { firebase } from './firebase';

/** Una colección del inventario (`users/{uid}/{colección}`). Nada se borra: se archiva. */
export interface InventoryRepository<T extends Archivable, I> {
  /** Avisa con todos los elementos, archivados incluidos, cada vez que cambian. */
  subscribe(
    uid: string,
    onItems: (items: T[]) => void,
    onError: (error: unknown) => void,
  ): () => void;
  create(uid: string, input: I): Promise<void>;
  update(uid: string, id: string, input: I): Promise<void>;
  setArchived(uid: string, id: string, archived: boolean): Promise<void>;
}

export interface InventoryRepositories {
  ammunition: InventoryRepository<Ammunition, AmmunitionInput>;
  ranges: InventoryRepository<Range, RangeInput>;
}

function firestoreCollection<T extends Archivable, I extends object>(
  name: string,
  parse: (id: string, data: Record<string, unknown>) => T,
): InventoryRepository<T, I> {
  const items = (uid: string) => collection(firebase().db, 'users', uid, name);
  return {
    subscribe(uid, onItems, onError) {
      return onSnapshot(
        items(uid),
        (snapshot) => onItems(snapshot.docs.map((d) => parse(d.id, d.data()))),
        onError,
      );
    },
    create(uid, input) {
      return setDoc(doc(items(uid)), { ...input, archived: false });
    },
    update(uid, id, input) {
      return updateDoc(doc(items(uid), id), { ...input });
    },
    setArchived(uid, id, archived) {
      return updateDoc(doc(items(uid), id), { archived });
    },
  };
}

export const firebaseInventoryRepositories: InventoryRepositories = {
  ammunition: firestoreCollection<Ammunition, AmmunitionInput>('ammunition', parseAmmunition),
  ranges: firestoreCollection<Range, RangeInput>('ranges', parseRange),
};
