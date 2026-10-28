import { createContext, useCallback, useContext } from 'react';
import { useOutletContext } from 'react-router';
import type { SessionRepository } from '@/data/session-repository';
import { sessionPhotoPaths, type Session } from '@/lib/sessions';
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

/** Margen después de que se cierra el toast antes de borrar las fotos. */
const UNDO_GRACE_MS = 1000;

/**
 * Elimina una sesión con "Deshacer" en un toast. Las fotos (de la sesión y de sus rondas) se
 * borran de Storage recién cuando ya no se puede deshacer.
 */
export function useDeleteSession() {
  const uid = useCurrentUser()?.uid;
  const repository = useSessionRepository();
  const photos = usePhotoRepository();
  const toast = useToast();

  return useCallback(
    async (session: Session): Promise<boolean> => {
      if (!uid) return false;
      let undo: () => Promise<void>;
      try {
        ({ undo } = await repository.remove(uid, session.id));
      } catch {
        toast.show({ message: 'No se pudo eliminar la sesión', tone: 'error' });
        return false;
      }
      let undone = false;
      // No depende de la pantalla: sigue corriendo aunque se navegue a otra.
      const timer = setTimeout(() => {
        if (undone) return;
        for (const path of sessionPhotoPaths(session)) photos.remove(path).catch(() => {});
      }, TOAST_DURATION_MS + UNDO_GRACE_MS);
      toast.show({
        message: 'Sesión eliminada',
        action: {
          label: 'Deshacer',
          onAction: () => {
            undone = true;
            clearTimeout(timer);
            undo().then(
              () => toast.show({ message: 'Sesión restaurada' }),
              () => toast.show({ message: 'No se pudo restaurar la sesión', tone: 'error' }),
            );
          },
        },
      });
      return true;
    },
    [uid, repository, photos, toast],
  );
}
