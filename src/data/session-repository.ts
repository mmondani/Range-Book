import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  rawRounds,
  removeRawRound,
  restoreRawRound,
  saveRawRound,
  type RawRound,
  type RoundFields,
} from '@/lib/rounds';
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
  /**
   * Agrega una ronda (si `roundId` es nuevo) o actualiza sus campos de M05. Si `keepAnalysis` es
   * `false`, borra su análisis y el puntaje calculado.
   */
  saveRound(
    uid: string,
    sessionId: string,
    roundId: string,
    fields: RoundFields,
    keepAnalysis: boolean,
  ): Promise<void>;
  /** Elimina una ronda y devuelve cómo deshacerlo: la vuelve a poner en su lugar, tal cual era. */
  removeRound(
    uid: string,
    sessionId: string,
    roundId: string,
  ): Promise<{ undo: () => Promise<void> }>;
}

const sessions = (uid: string) => collection(firebase().db, 'users', uid, 'sessions');

/**
 * Lee las rondas crudas de la sesión (con el análisis completo, que `parseSession` no lee) y
 * escribe las que devuelve `change`. No es una transacción: así funciona también sin conexión,
 * con la caché local. Un solo usuario edita sus sesiones, así que no hay escrituras en conflicto.
 */
async function changeRounds(
  uid: string,
  sessionId: string,
  change: (rounds: RawRound[]) => RawRound[],
): Promise<void> {
  const ref = doc(sessions(uid), sessionId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('La sesión no existe');
  await updateDoc(ref, { rounds: change(rawRounds(snapshot.data().rounds)) });
}

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
  saveRound(uid, sessionId, roundId, fields, keepAnalysis) {
    return changeRounds(uid, sessionId, (rounds) =>
      saveRawRound(rounds, roundId, fields, keepAnalysis),
    );
  },
  async removeRound(uid, sessionId, roundId) {
    let removed: ReturnType<typeof removeRawRound>['removed'];
    await changeRounds(uid, sessionId, (rounds) => {
      const result = removeRawRound(rounds, roundId);
      removed = result.removed;
      return result.rounds;
    });
    return {
      undo: async () => {
        const round = removed;
        if (round) await changeRounds(uid, sessionId, (rounds) => restoreRawRound(rounds, round));
      },
    };
  },
};
