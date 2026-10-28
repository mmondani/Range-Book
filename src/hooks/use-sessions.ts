import { createContext, useCallback, useContext } from 'react';
import { useOutletContext } from 'react-router';
import type { SessionRepository } from '@/data/session-repository';
import { sessionPhotoPaths, type Round, type Session } from '@/lib/sessions';
import type { Target } from '@/lib/targets';
import { useCurrentUser } from './use-auth';
import { usePhotoRepository } from './use-photos';
import type { SessionData } from './use-session-data';
import { TOAST_DURATION_MS, useToast } from './use-toast';

export const SessionContext = createContext<SessionRepository | null>(null);

export function useSessionRepository(): SessionRepository {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSessionRepository necesita un SessionProvider');
  return context;
}

/** Lo que la lista de sesiones le pasa al detalle (ruta hija). */
export interface SessionsOutletContext {
  data: SessionData;
  /** La lista con su query string (búsqueda y filtro), para volver. */
  listPath: string;
}

export function useSessionsOutlet(): SessionsOutletContext {
  return useOutletContext<SessionsOutletContext>();
}

/** Lo que el detalle de la sesión les pasa a los sheets de sus rondas (rutas hijas). */
export interface SessionDetailOutletContext {
  session: Session;
  sessions: Session[];
  targets: Target[];
  /** El detalle de la sesión, adonde vuelve el sheet al cerrarse. */
  listPath: string;
}

export function useSessionDetailOutlet(): SessionDetailOutletContext {
  return useOutletContext<SessionDetailOutletContext>();
}

/** Margen después de que se cierra el toast antes de borrar las fotos. */
const UNDO_GRACE_MS = 1000;

interface UndoableRemoveMessages {
  removed: string;
  restored: string;
  removeFailed: string;
  restoreFailed: string;
}

/**
 * Elimina algo con "Deshacer" en un toast. Sus fotos se borran de Storage recién cuando ya no se
 * puede deshacer.
 */
function useUndoableRemove() {
  const photos = usePhotoRepository();
  const toast = useToast();

  return useCallback(
    async (
      remove: () => Promise<{ undo: () => Promise<void> }>,
      photoPaths: readonly string[],
      messages: UndoableRemoveMessages,
    ): Promise<boolean> => {
      let undo: () => Promise<void>;
      try {
        ({ undo } = await remove());
      } catch {
        toast.show({ message: messages.removeFailed, tone: 'error' });
        return false;
      }
      let undone = false;
      // No depende de la pantalla: sigue corriendo aunque se navegue a otra.
      const timer = setTimeout(() => {
        if (undone) return;
        for (const path of photoPaths) photos.remove(path).catch(() => {});
      }, TOAST_DURATION_MS + UNDO_GRACE_MS);
      toast.show({
        message: messages.removed,
        action: {
          label: 'Deshacer',
          onAction: () => {
            undone = true;
            clearTimeout(timer);
            undo().then(
              () => toast.show({ message: messages.restored }),
              () => toast.show({ message: messages.restoreFailed, tone: 'error' }),
            );
          },
        },
      });
      return true;
    },
    [photos, toast],
  );
}

/** Elimina una sesión con "Deshacer". Las fotos de la sesión y de sus rondas se borran después. */
export function useDeleteSession() {
  const uid = useCurrentUser()?.uid;
  const repository = useSessionRepository();
  const remove = useUndoableRemove();

  return useCallback(
    async (session: Session): Promise<boolean> => {
      if (!uid) return false;
      return remove(() => repository.remove(uid, session.id), sessionPhotoPaths(session), {
        removed: 'Sesión eliminada',
        restored: 'Sesión restaurada',
        removeFailed: 'No se pudo eliminar la sesión',
        restoreFailed: 'No se pudo restaurar la sesión',
      });
    },
    [uid, repository, remove],
  );
}

/** Elimina una ronda con "Deshacer". Su foto se borra después. */
export function useDeleteRound() {
  const uid = useCurrentUser()?.uid;
  const repository = useSessionRepository();
  const remove = useUndoableRemove();

  return useCallback(
    async (session: Pick<Session, 'id'>, round: Round): Promise<boolean> => {
      if (!uid) return false;
      return remove(
        () => repository.removeRound(uid, session.id, round.id),
        round.photo ? [round.photo] : [],
        {
          removed: 'Ronda eliminada',
          restored: 'Ronda restaurada',
          removeFailed: 'No se pudo eliminar la ronda',
          restoreFailed: 'No se pudo restaurar la ronda',
        },
      );
    },
    [uid, repository, remove],
  );
}
