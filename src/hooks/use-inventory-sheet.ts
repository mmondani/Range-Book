import { useState } from 'react';
import type { InventoryRepository } from '@/data/inventory-repository';
import type { Archivable, FieldErrors } from '@/lib/inventory';
import { useCurrentUser } from './use-auth';
import {
  useArchiveActions,
  useCloseSheet,
  useSheetOutlet,
  type ArchiveMessages,
} from './use-inventory';
import { useItemForm } from './use-item-form';
import { useToast } from './use-toast';

export interface InventorySheetOptions<T extends Archivable, I extends object> {
  /** Elemento a editar; sin él, es un alta. */
  item?: T;
  initial: I;
  validate: (input: I) => FieldErrors<I>;
  clean: (input: I) => I;
  repository: InventoryRepository<T, I>;
  messages: ArchiveMessages & { created: string };
}

/** Lógica común de los sheets de alta y edición del inventario: guardar, archivar y cerrar. */
export function useInventorySheet<T extends Archivable, I extends object>({
  item,
  initial,
  validate,
  clean,
  repository,
  messages,
}: InventorySheetOptions<T, I>) {
  const uid = useCurrentUser()?.uid;
  const { listPath } = useSheetOutlet();
  const close = useCloseSheet(listPath);
  const toast = useToast();
  const { archive } = useArchiveActions(repository, messages);
  const [archiving, setArchiving] = useState(false);

  const form = useItemForm({
    initial,
    validate,
    async save(input) {
      if (!uid) return;
      try {
        if (item) await repository.update(uid, item.id, clean(input));
        else await repository.create(uid, clean(input));
      } catch {
        toast.show({ message: 'No se pudo guardar', tone: 'error' });
        return;
      }
      toast.show({ message: item ? 'Cambios guardados' : messages.created });
      close();
    },
  });

  async function handleArchive() {
    if (!item) return;
    setArchiving(true);
    const archived = await archive(item);
    setArchiving(false);
    if (archived) close();
  }

  return {
    form,
    // Un archivado se puede editar si se entra por URL, pero no se vuelve a archivar.
    archive: item && !item.archived ? { onArchive: handleArchive, loading: archiving } : undefined,
    /** Props para `InventorySheet`. */
    props: {
      dirty: form.dirty,
      saving: form.saving,
      errorAttempt: form.errorAttempt,
      onClose: close,
      onSubmit: form.submit,
    },
  };
}
