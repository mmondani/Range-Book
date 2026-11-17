import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import type { AnalysisResult } from '@/lib/analysis';
import type { RoundMantis } from '@/lib/mantis';
import { migrateRounds } from '@/lib/metrics-migration';
import {
  rawRounds,
  removeRawMantis,
  removeRawRound,
  restoreRawMantis,
  restoreRawRound,
  saveRawAnalysis,
  saveRawMantis,
  saveRawRound,
  type RawRound,
  type RoundFields,
} from '@/lib/rounds';
import { settleWrite } from '@/lib/offline-write';
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
  /** Guarda el análisis de una ronda y su puntaje calculado (si se confirmó). */
  saveAnalysis(
    uid: string,
    sessionId: string,
    roundId: string,
    result: AnalysisResult,
  ): Promise<void>;
  /** Elimina una ronda y devuelve cómo deshacerlo: la vuelve a poner en su lugar, tal cual era. */
  removeRound(
    uid: string,
    sessionId: string,
    roundId: string,
  ): Promise<{ undo: () => Promise<void> }>;
  /**
   * Guarda los datos de MantisX importados en sus rondas: una escritura por sesión. Las rondas que
   * ya no existen o ya tienen datos de MantisX se saltean. Devuelve cuántas rondas se guardaron.
   */
  applyMantisImport(uid: string, imports: readonly MantisRoundImport[]): Promise<number>;
  /** Quita los datos de MantisX de una ronda y devuelve cómo deshacerlo. */
  removeMantis(
    uid: string,
    sessionId: string,
    roundId: string,
  ): Promise<{ undo: () => Promise<void> }>;
  /**
   * Reprocesa los análisis guardados (radio medio en lugar de la distancia al centro, ADR 0008).
   * Solo escribe las sesiones que lo necesitan y devuelve cuántas fueron: correrla de nuevo no
   * escribe nada.
   */
  migrateMeanRadius(uid: string): Promise<number>;
}

/** Datos de MantisX para una ronda. */
export interface MantisRoundImport {
  sessionId: string;
  roundId: string;
  mantis: RoundMantis;
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
  await settleWrite(updateDoc(ref, { rounds: change(rawRounds(snapshot.data().rounds)) }));
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
    return settleWrite(setDoc(doc(sessions(uid), id), { ...fields, rounds: [] }));
  },
  update(uid, id, fields) {
    return settleWrite(updateDoc(doc(sessions(uid), id), { ...fields }));
  },
  async remove(uid, id) {
    const ref = doc(sessions(uid), id);
    // Se guarda el documento crudo (con las rondas y su análisis completos) para "Deshacer".
    const data = (await getDoc(ref)).data();
    await settleWrite(deleteDoc(ref));
    return {
      undo: async () => {
        if (data) await settleWrite(setDoc(ref, data));
      },
    };
  },
  saveRound(uid, sessionId, roundId, fields, keepAnalysis) {
    return changeRounds(uid, sessionId, (rounds) =>
      saveRawRound(rounds, roundId, fields, keepAnalysis, new Date().toISOString()),
    );
  },
  saveAnalysis(uid, sessionId, roundId, result) {
    return changeRounds(uid, sessionId, (rounds) => {
      const next = saveRawAnalysis(rounds, roundId, result);
      if (!next) throw new Error('La ronda no existe');
      return next;
    });
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
  async applyMantisImport(uid, imports) {
    const bySession = new Map<string, Map<string, RoundMantis>>();
    for (const { sessionId, roundId, mantis } of imports) {
      const rounds = bySession.get(sessionId) ?? new Map<string, RoundMantis>();
      rounds.set(roundId, mantis);
      bySession.set(sessionId, rounds);
    }
    const counts = await Promise.all(
      [...bySession].map(async ([sessionId, mantis]) => {
        let saved = 0;
        await changeRounds(uid, sessionId, (rounds) => {
          const result = saveRawMantis(rounds, mantis);
          saved = result.saved;
          return result.rounds;
        });
        return saved;
      }),
    );
    return counts.reduce((total, count) => total + count, 0);
  },
  async removeMantis(uid, sessionId, roundId) {
    let removed: unknown;
    await changeRounds(uid, sessionId, (rounds) => {
      const result = removeRawMantis(rounds, roundId);
      removed = result.removed;
      return result.rounds;
    });
    return {
      undo: async () => {
        const mantis = removed;
        if (mantis) {
          await changeRounds(uid, sessionId, (rounds) => restoreRawMantis(rounds, roundId, mantis));
        }
      },
    };
  },
  async migrateMeanRadius(uid) {
    // Igual que `changeRounds`, sin transacción: también funciona sin conexión (con la caché).
    const snapshot = await getDocs(sessions(uid));
    const writes = snapshot.docs.flatMap((d) => {
      const rounds = migrateRounds(rawRounds(d.data().rounds));
      return rounds ? [settleWrite(updateDoc(d.ref, { rounds }))] : [];
    });
    await Promise.all(writes);
    return writes.length;
  },
};
