import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { parseMantisTrace, type MantisTrace } from '@/lib/mantis';
import { settleWrite } from '@/lib/offline-write';
import { firebase } from './firebase';

/**
 * Trayectorias de MantisX (`users/{uid}/mantisTraces/{sessionPk}`). Van aparte de la sesión para
 * no acercarla al límite de 1 MiB y para que la lista de sesiones no las cargue: se leen solo al
 * ver la trayectoria de una ronda.
 */
export interface MantisTraceRepository {
  /** La trayectoria, o `null` si no existe (todavía sin sincronizar o borrada) o está dañada. */
  get(uid: string, sessionPk: number): Promise<MantisTrace | null>;
  /** Guarda (o reemplaza) la trayectoria de la sesión de MantisX. */
  save(uid: string, sessionPk: number, trace: MantisTrace): Promise<void>;
  /** Borra la trayectoria; si ya no existe, no falla. */
  remove(uid: string, sessionPk: number): Promise<void>;
}

const trace = (uid: string, sessionPk: number) =>
  doc(firebase().db, 'users', uid, 'mantisTraces', String(sessionPk));

export const firebaseMantisTraceRepository: MantisTraceRepository = {
  async get(uid, sessionPk) {
    const snapshot = await getDoc(trace(uid, sessionPk));
    return snapshot.exists() ? parseMantisTrace(snapshot.data()) : null;
  },
  save(uid, sessionPk, data) {
    return settleWrite(setDoc(trace(uid, sessionPk), { ...data }));
  },
  remove(uid, sessionPk) {
    return settleWrite(deleteDoc(trace(uid, sessionPk)));
  },
};
