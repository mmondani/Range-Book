import { Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Input } from '@/components/input';
import { InventorySheet } from '@/components/inventory-sheet';
import { PhotoPicker } from '@/components/photo-picker';
import { SegmentedControl } from '@/components/segmented-control';
import { ZoneEditor } from '@/components/zone-editor';
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
import { NAME_MAX_LENGTH } from '@/lib/inventory';
import { removedPhotos, uploadPhotos } from '@/lib/photos';
import {
  referenceSize,
  targetClipboardText,
  targetDraft,
  targetInput,
  targetName,
  targetZoneErrors,
  validateTarget,
  type Target,
  type TargetScoring,
} from '@/lib/targets';

const MESSAGES = { archived: 'Blanco archivado', restored: 'Blanco restaurado' };

const SCORING_OPTIONS = [
  { value: 'rings', label: 'Anillos concéntricos' },
  { value: 'none', label: 'Sin zonas' },
] as const;

const SCORING_HELP: Record<TargetScoring, string> = {
  rings: 'El análisis calcula el puntaje y las medidas en mm a partir de las zonas.',
  none: 'Sin zonas: el puntaje se carga a mano. El ancho de referencia sirve de escala para medir el grupo y el PMI en mm.',
};

/** M12 · Alta y edición de un blanco (sheet en mobile, diálogo en desktop). */
export function TargetSheet({ item }: { item?: Target }) {
  const uid = useCurrentUser()?.uid;
  const { listPath } = useSheetOutlet();
  const close = useCloseSheet(listPath);
  const toast = useToast();
  const photoRepository = usePhotoRepository();
  const repository = useInventoryRepositories().targets;
  const { archive } = useArchiveActions(repository, MESSAGES);
  const [archiving, setArchiving] = useState(false);
  const [initial] = useState(() => targetDraft(item));

  const form = useItemForm({
    initial,
    validate: validateTarget,
    async save(draft) {
      if (!uid) return;
      // El id se genera antes de guardar para armar la ruta de la foto.
      const id = item?.id ?? repository.newId(uid);
      try {
        const [photo = null] = await uploadPhotos(
          draft.photos,
          { uid, kind: 'targets', docId: id },
          photoRepository,
        );
        const input = targetInput(draft, photo);
        if (item) await repository.update(uid, id, input);
        else await repository.create(uid, input, id);
      } catch {
        toast.show({ message: 'No se pudo guardar', tone: 'error' });
        return;
      }
      // La foto reemplazada o quitada se borra recién después de guardar el documento.
      if (item?.photo) {
        for (const path of removedPhotos([item.photo], draft.photos)) {
          photoRepository.remove(path).catch(() => {});
        }
      }
      toast.show({ message: item ? 'Cambios guardados' : 'Blanco agregado' });
      close();
    },
  });
  const { draft, errors, setField } = form;
  const rings = draft.scoring === 'rings';

  /** Copia el blanco guardado (no lo que se está editando) para la herramienta de calibración. */
  async function handleCopy() {
    if (!item) return;
    try {
      await navigator.clipboard.writeText(targetClipboardText(item));
      toast.show({ message: 'Blanco copiado' });
    } catch {
      toast.show({ message: 'No se pudo copiar', tone: 'error' });
    }
  }

  async function handleArchive() {
    if (!item) return;
    setArchiving(true);
    const archived = await archive(item);
    setArchiving(false);
    if (archived) close();
  }

  return (
    <InventorySheet
      title={item ? 'Editar blanco' : 'Nuevo blanco'}
      eyebrow={item ? targetName(item) : 'Inventario'}
      submitLabel={item ? 'Guardar cambios' : 'Guardar blanco'}
      archive={
        item && !item.archived
          ? { label: 'Archivar blanco', onArchive: handleArchive, loading: archiving }
          : undefined
      }
      dirty={form.dirty}
      saving={form.saving}
      errorAttempt={form.errorAttempt}
      onClose={close}
      onSubmit={form.submit}
    >
      <Field label="Nombre" required error={errors.name}>
        <Input
          value={draft.name}
          onChange={(event) => setField('name', event.target.value)}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="off"
          placeholder="Ej: ISSF Pistola Precisión"
          data-autofocus
        />
      </Field>
      <Field label="Foto" kind="group">
        <PhotoPicker
          multiple={false}
          value={draft.photos}
          onChange={(photos) => setField('photos', photos)}
        />
      </Field>
      <Field label="Puntuación" kind="group" help={SCORING_HELP[draft.scoring]}>
        <SegmentedControl
          options={SCORING_OPTIONS}
          value={draft.scoring}
          onChange={(scoring) => setField('scoring', scoring)}
        />
      </Field>
      <Field
        label={rings ? 'Diámetro de la zona exterior' : 'Ancho de referencia del blanco'}
        required
        error={errors.referenceSize}
      >
        <Input
          value={draft.referenceSize}
          onChange={(event) => setField('referenceSize', event.target.value)}
          inputMode="decimal"
          autoComplete="off"
          suffix="mm"
          placeholder={rings ? 'Ej: 500' : 'Ej: 460'}
          className="num"
        />
      </Field>
      {rings && (
        <ZoneEditor
          zones={draft.zones}
          onChange={(zones) => setField('zones', zones)}
          referenceMm={referenceSize(draft)}
          rowErrors={errors.zones ? targetZoneErrors(draft) : undefined}
          error={errors.zones}
        />
      )}
      {item && (
        <Field
          label="Calibración de la detección"
          kind="group"
          help="Copia el nombre y las zonas guardadas del blanco para pegarlos en la herramienta de calibración."
        >
          <Button onClick={() => void handleCopy()}>
            <Copy size={18} aria-hidden="true" />
            Copiar para calibración
          </Button>
        </Field>
      )}
    </InventorySheet>
  );
}
