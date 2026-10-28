import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { parseSession, type Session, type SessionFields } from '@/lib/sessions';
import { firebase } from './firebase';

/** Sesiones del usuario (`users/{uid}/sessions`). A diferencia del inventario, se eliminan. */
export interface SessionRepository {
  /** Avisa con todas las sesiones cada vez que cambian. */
  subscribe(
    uid: string,
    onItems: (items: Session[]) => void,
    onError: (error: unknown) => void,
  ): () => void;
  /** Id para una sesión nueva, antes de crearla (rutas de las fotos). */
  newId(uid: string): string;
  /** Crea la sesión sin rondas. */
  create(uid: string, id: string, fields: SessionFields): Promise<void>;
  /** Actualiza los campos de M04; las rondas no se tocan. */
  update(uid: string, id: string, fields: SessionFields): Promise<void>;
  /** Elimina la sesión y devuelve cómo deshacerlo: vuelve a escribir el documento tal cual era. */
  remove(uid: string, id: string): Promise<{ undo: () => Promise<void> }>;
}

const sessions = (uid: string) => collection(firebase().db, 'users', uid, 'sessions');

export const firebaseSessionRepository: SessionRepository = {
  subscribe(uid, onItems, onError) {
    return onSnapshot(
      sessions(uid),
      (snapshot) => onItems(snapshot.docs.map((d) => parseSession(d.id, d.data()))),
      onError,
    );
  },
  newId(uid) {
    return doc(sessions(uid)).id;
  },
  create(uid, id, fields) {
    return setDoc(doc(sessions(uid), id), { ...fields, rounds: [] });
  },
  update(uid, id, fields) {
    return updateDoc(doc(sessions(uid), id), { ...fields });
  },
  async remove(uid, id) {
    const ref = doc(sessions(uid), id);
    // Se guarda el documento crudo (con las rondas y su análisis completos) para "Deshacer".
    const data = (await getDoc(ref)).data();
    await deleteDoc(ref);
    return {
      undo: async () => {
        if (data) await setDoc(ref, data);
      },
    };
  },
};
