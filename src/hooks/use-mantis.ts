import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { MantisTraceRepository } from '@/data/mantis-trace-repository';
import type { MantisTrace } from '@/lib/mantis';
import type { ImportedMantisSession } from '@/lib/mantis-import';
import type { Round, Session } from '@/lib/sessions';
import { useCurrentUser } from './use-auth';
import { useSessionRepository, useUndoableRemove } from './use-sessions';

export const MantisTraceContext = createContext<MantisTraceRepository | null>(null);

export function useMantisTraceRepository(): MantisTraceRepository {
  const context = useContext(MantisTraceContext);
  if (!context) throw new Error('useMantisTraceRepository necesita un MantisTraceProvider');
  return context;
}

export type MantisTraceState =
  | { status: 'loading' }
  /** No existe (todavía sin sincronizar o borrada), está dañada o no se pudo leer. */
  | { status: 'missing' }
  | { status: 'ready'; trace: MantisTrace };

/** Trayectoria de una sesión de MantisX, leída al mostrarla. */
export function useMantisTrace(sessionPk: number | undefined): MantisTraceState {
  const uid = useCurrentUser()?.uid;
  const repository = useMantisTraceRepository();
  const [state, setState] = useState<{ key?: string; value: MantisTraceState }>({
    value: { status: 'loading' },
  });
  const key = uid && sessionPk !== undefined ? `${uid}/${sessionPk}` : undefined;

  useEffect(() => {
    if (!uid || sessionPk === undefined) return;
    let active = true;
    repository.get(uid, sessionPk).then(
      (trace) => {
        if (active) {
          setState({ key, value: trace ? { status: 'ready', trace } : { status: 'missing' } });
        }
      },
      () => {
        if (active) setState({ key, value: { status: 'missing' } });
      },
    );
    return () => {
      active = false;
    };
  }, [uid, sessionPk, repository, key]);

  return state.key === key ? state.value : { status: 'loading' };
}

/** Una sesión de MantisX elegida para una ronda. */
export interface MantisImportItem {
  sessionId: string;
  roundId: string;
  session: ImportedMantisSession;
}

/**
 * Importa las sesiones de MantisX elegidas: primero las trayectorias y después los resúmenes en
 * las rondas (una escritura por sesión de Range Book). Devuelve cuántas rondas se guardaron.
 */
export function useImportMantis() {
  const uid = useCurrentUser()?.uid;
  const sessions = useSessionRepository();
  const traces = useMantisTraceRepository();

  return useCallback(
    async (items: readonly MantisImportItem[]): Promise<number> => {
      if (!uid) throw new Error('No hay usuario');
      await Promise.all(
        items.map(({ session }) => traces.save(uid, session.summary.sessionPk, session.trace)),
      );
      return sessions.applyMantisImport(
        uid,
        items.map(({ sessionId, roundId, session }) => ({
          sessionId,
          roundId,
          mantis: session.summary,
        })),
      );
    },
    [uid, sessions, traces],
  );
}

/** Quita los datos de MantisX de una ronda con "Deshacer"; la trayectoria se borra después. */
export function useRemoveMantis() {
  const uid = useCurrentUser()?.uid;
  const sessions = useSessionRepository();
  const traces = useMantisTraceRepository();
  const remove = useUndoableRemove();

  return useCallback(
    async (session: Pick<Session, 'id'>, round: Round): Promise<boolean> => {
      const pk = round.mantis?.sessionPk;
      if (!uid || pk === undefined) return false;
      return remove(
        () => sessions.removeMantis(uid, session.id, round.id),
        () => {
          traces.remove(uid, pk).catch(() => {});
        },
        {
          removed: 'Se quitaron los datos de MantisX',
          restored: 'Datos de MantisX restaurados',
          removeFailed: 'No se pudieron quitar los datos de MantisX',
          restoreFailed: 'No se pudieron restaurar los datos de MantisX',
        },
      );
    },
    [uid, sessions, traces, remove],
  );
}
