import { createContext, useCallback, useContext } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router';
import type { InventoryRepositories, InventoryRepository } from '@/data/inventory-repository';
import type { Configuration, Firearm } from '@/lib/firearms';
import type { Ammunition, Archivable, Range } from '@/lib/inventory';
import type { Target } from '@/lib/targets';
import { useCurrentUser } from './use-auth';
import type { CollectionState } from './use-collection';
import { useToast } from './use-toast';

export const InventoryContext = createContext<InventoryRepositories | null>(null);

export function useInventoryRepositories(): InventoryRepositories {
  const context = useContext(InventoryContext);
  if (!context) throw new Error('useInventoryRepositories necesita un InventoryProvider');
  return context;
}

/** Lo que toda pantalla con sheets (rutas hijas) les pasa. */
export interface SheetOutletContext {
  /** Adónde vuelve el sheet al cerrarse: la lista con su query string, o el detalle del arma. */
  listPath: string;
}

export function useSheetOutlet(): SheetOutletContext {
  return useOutletContext<SheetOutletContext>();
}

/** Lo que la pantalla de inventario les pasa a sus sheets. */
export interface InventoryOutletContext extends SheetOutletContext {
  firearms: CollectionState<Firearm>;
  configurations: CollectionState<Configuration>;
  ammunition: CollectionState<Ammunition>;
  ranges: CollectionState<Range>;
  targets: CollectionState<Target>;
}

export function useInventoryOutlet(): InventoryOutletContext {
  return useOutletContext<InventoryOutletContext>();
}

/** Estado de navegación de los links que abren un sheet desde la lista. */
export const OPENED_FROM_LIST = { fromList: true };

/**
 * Cierra el sheet volviendo a la lista. Si se abrió desde la lista, vuelve atrás en el historial
 * (así "atrás" no lo reabre); si se entró directo por URL, reemplaza la entrada.
 */
export function useCloseSheet(listPath: string): () => void {
  const navigate = useNavigate();
  const { state } = useLocation();
  const fromList = (state as typeof OPENED_FROM_LIST | null)?.fromList === true;
  return useCallback(() => {
    if (fromList) navigate(-1);
    else navigate(listPath, { replace: true });
  }, [fromList, listPath, navigate]);
}

export interface ArchiveMessages {
  archived: string;
  restored: string;
}

/** Archivar (con "Deshacer") y restaurar, avisando con un toast. */
export function useArchiveActions<T extends Archivable>(
  repository: InventoryRepository<T, unknown>,
  messages: ArchiveMessages,
) {
  const uid = useCurrentUser()?.uid;
  const toast = useToast();

  const setArchived = useCallback(
    async (item: T, archived: boolean, undo = true) => {
      if (!uid) return;
      try {
        await repository.setArchived(uid, item.id, archived);
      } catch {
        toast.show({
          message: archived ? 'No se pudo archivar' : 'No se pudo restaurar',
          tone: 'error',
        });
        return false;
      }
      toast.show({
        message: archived ? messages.archived : messages.restored,
        action: undo
          ? { label: 'Deshacer', onAction: () => void setArchived(item, !archived, false) }
          : undefined,
      });
      return true;
    },
    [uid, repository, toast, messages.archived, messages.restored],
  );

  return {
    archive: useCallback((item: T) => setArchived(item, true), [setArchived]),
    restore: useCallback((item: T) => setArchived(item, false), [setArchived]),
  };
}
