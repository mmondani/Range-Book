import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { DateInput } from '@/components/date-input';
import { Field } from '@/components/field';
import { Input } from '@/components/input';
import { InventorySheet } from '@/components/inventory-sheet';
import { PhotoPicker } from '@/components/photo-picker';
import { useCurrentUser } from '@/hooks/use-auth';
import {
  useArchiveActions,
  useCloseSheet,
  useInventoryRepositories,
  useSheetOutlet,
} from '@/hooks/use-inventory';
import { useItemForm } from '@/hooks/use-item-form';
import { usePhotoRepository } from '@/hooks/use-photos';
import { useToast } from '@/hooks/use-toast';
import {
  caliberSuggestions,
  firearmDraft,
  firearmInput,
  firearmName,
  validateFirearm,
  type Firearm,
} from '@/lib/firearms';
import { isoDate } from '@/lib/format';
import { NAME_MAX_LENGTH, TEXT_MAX_LENGTH } from '@/lib/inventory';
import { removedPhotos, uploadPhotos } from '@/lib/photos';
import styles from './inventory-sheet-fields.module.css';

const MESSAGES = { archived: 'Arma archivada', restored: 'Arma restaurada' };

export interface FirearmSheetProps {
  item?: Firearm;
  /** Todas las armas, para sugerir los calibres ya usados. */
  firearms: readonly Firearm[];
}

/**
 * M10 · Alta y edición de un arma (sheet en mobile, diálogo en desktop). Al crearla, abre su
 * detalle para cargar modificaciones y configuraciones.
 */
export function FirearmSheet({ item, firearms }: FirearmSheetProps) {
  const uid = useCurrentUser()?.uid;
  const { listPath } = useSheetOutlet();
  const close = useCloseSheet(listPath);
  const navigate = useNavigate();
  const toast = useToast();
  const photoRepository = usePhotoRepository();
  const repository = useInventoryRepositories().firearms;
  const { archive } = useArchiveActions(repository, MESSAGES);
  const [archiving, setArchiving] = useState(false);
  const [initial] = useState(() => firearmDraft(item));
  const [today] = useState(() => isoDate());
  const caliberListId = useId();

  const form = useItemForm({
    initial,
    validate: (draft) => validateFirearm(draft, today),
    async save(draft) {
      if (!uid) return;
      // El id se genera antes de guardar para armar la ruta de las fotos.
      const id = item?.id ?? repository.newId(uid);
      try {
        const photos = await uploadPhotos(
          draft.photos,
          { uid, kind: 'firearms', docId: id },
          photoRepository,
        );
        const input = firearmInput(draft, photos);
        if (item) await repository.update(uid, id, input);
        else await repository.create(uid, input, id);
      } catch {
        toast.show({ message: 'No se pudo guardar', tone: 'error' });
        return;
      }
      // Las fotos quitadas se borran recién después de guardar el documento.
      if (item) {
        for (const path of removedPhotos(item.photos, draft.photos)) {
          photoRepository.remove(path).catch(() => {});
        }
      }
      toast.show({ message: item ? 'Cambios guardados' : 'Arma agregada' });
      if (item) close();
      else navigate(`/inventario/armas/${id}`, { replace: true });
    },
  });
  const { draft, errors, setField } = form;

  async function handleArchive() {
    if (!item) return;
    setArchiving(true);
    const archived = await archive(item);
    setArchiving(false);
    if (archived) close();
  }

  return (
    <InventorySheet
      title={item ? 'Editar arma' : 'Nueva arma'}
      eyebrow={item ? firearmName(item) : 'Inventario'}
      submitLabel={item ? 'Guardar cambios' : 'Guardar arma'}
      archive={
        item && !item.archived
          ? { label: 'Archivar arma', onArchive: handleArchive, loading: archiving }
          : undefined
      }
      dirty={form.dirty}
      saving={form.saving}
      errorAttempt={form.errorAttempt}
      onClose={close}
      onSubmit={form.submit}
    >
      <Field
        label="Fotos"
        kind="group"
        help="La primera foto se usa como portada."
        error={errors.photos}
      >
        <PhotoPicker cover value={draft.photos} onChange={(photos) => setField('photos', photos)} />
      </Field>
      <div className={styles.pair}>
        <Field label="Marca" required error={errors.brand}>
          <Input
            value={draft.brand}
            onChange={(event) => setField('brand', event.target.value)}
            maxLength={NAME_MAX_LENGTH}
            autoComplete="off"
            placeholder="Ej: Glock"
          />
        </Field>
        <Field label="Modelo" required error={errors.model}>
          <Input
            value={draft.model}
            onChange={(event) => setField('model', event.target.value)}
            maxLength={NAME_MAX_LENGTH}
            autoComplete="off"
            placeholder="Ej: 17 Gen5"
          />
        </Field>
      </div>
      <Field label="Calibre" required error={errors.caliber}>
        <Input
          value={draft.caliber}
          onChange={(event) => setField('caliber', event.target.value)}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="off"
          list={caliberListId}
          placeholder="Ej: 9×19 mm"
        />
      </Field>
      <datalist id={caliberListId}>
        {caliberSuggestions(firearms).map((caliber) => (
          <option key={caliber} value={caliber} />
        ))}
      </datalist>
      <div className={styles.pair}>
        <Field label="Fecha de compra" error={errors.purchaseDate}>
          <DateInput
            value={draft.purchaseDate}
            max={today}
            onChange={(event) => setField('purchaseDate', event.target.value)}
          />
        </Field>
        <Field label="Lugar de compra">
          <Input
            value={draft.purchasePlace}
            onChange={(event) => setField('purchasePlace', event.target.value)}
            maxLength={TEXT_MAX_LENGTH}
            autoComplete="off"
          />
        </Field>
      </div>
      <Field
        label="Tiros previos al registro"
        help="Los disparos de cada sesión se suman automáticamente al acumulado."
        error={errors.priorShots}
      >
        <Input
          value={draft.priorShots}
          onChange={(event) => setField('priorShots', event.target.value)}
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          className="num"
        />
      </Field>
      {!item && (
        <p className={styles.note}>
          Las modificaciones y configuraciones se cargan desde el detalle del arma, después de
          guardarla.
        </p>
      )}
    </InventorySheet>
  );
}
