import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Field } from '@/components/field';
import { Input } from '@/components/input';
import { InventorySheet } from '@/components/inventory-sheet';
import { PhotoPicker } from '@/components/photo-picker';
import { Select } from '@/components/select';
import { Stepper } from '@/components/stepper';
import { Textarea } from '@/components/textarea';
import { useCurrentUser } from '@/hooks/use-auth';
import { useCloseSheet } from '@/hooks/use-inventory';
import { useItemForm } from '@/hooks/use-item-form';
import { usePhotoRepository } from '@/hooks/use-photos';
import { useDeleteRound, useSessionRepository } from '@/hooks/use-sessions';
import { useToast } from '@/hooks/use-toast';
import { formatInteger, formatShortDate } from '@/lib/format';
import { removedPhotos, uploadPhotos } from '@/lib/photos';
import {
  COMMENTS_MAX_LENGTH,
  discardsAnalysis,
  MAX_ROUND_SHOTS,
  newRoundDraft,
  roundDraft,
  roundFields,
  roundMaxScore,
  roundTargets,
  validateRound,
} from '@/lib/rounds';
import { MAX_SESSION_ROUNDS, type Round, type Session } from '@/lib/sessions';
import { targetName, type Target } from '@/lib/targets';
import styles from './round-sheet.module.css';

export interface RoundSheetProps {
  session: Session;
  /** Todas las sesiones: la primera ronda de una sesión toma los defaults de la anterior. */
  sessions: readonly Session[];
  targets: readonly Target[];
  /** Ronda a editar; sin ella, es un alta. */
  round?: Round;
  /** Adónde vuelve al cerrarse: el detalle de la sesión. */
  listPath: string;
}

/** M05 · Agregar o editar una ronda (sheet sobre M03, diálogo en desktop). */
export function RoundSheet({ session, sessions, targets, round, listPath }: RoundSheetProps) {
  const uid = useCurrentUser()?.uid;
  const close = useCloseSheet(listPath);
  const navigate = useNavigate();
  const toast = useToast();
  const photoRepository = usePhotoRepository();
  const repository = useSessionRepository();
  const deleteRound = useDeleteRound();
  const [initial] = useState(() =>
    round ? roundDraft(round) : newRoundDraft(session, sessions, targets),
  );
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Fijo mientras el sheet está abierto: al guardar o eliminar, la sesión cambia antes de cerrarlo.
  const [number] = useState(() => {
    const index = round ? session.rounds.findIndex((item) => item.id === round.id) : -1;
    return index === -1 ? session.rounds.length + 1 : index + 1;
  });

  const form = useItemForm({
    initial,
    validate: (draft) => validateRound(draft, targets),
    async save(draft) {
      if (!uid) return;
      if (!round && session.rounds.length >= MAX_SESSION_ROUNDS) {
        toast.show({
          message: `Una sesión puede tener hasta ${MAX_SESSION_ROUNDS} rondas`,
          tone: 'error',
        });
        return;
      }
      // El id se genera antes de guardar para armar la ruta de la foto.
      const id = round?.id ?? crypto.randomUUID();
      let photo: string | null;
      try {
        [photo = null] = await uploadPhotos(
          draft.photos,
          { uid, kind: 'rounds', docId: id },
          photoRepository,
        );
        await repository.saveRound(
          uid,
          session.id,
          id,
          roundFields(draft, photo),
          !discardsAnalysis(round, draft),
        );
      } catch {
        toast.show({ message: 'No se pudo guardar la ronda', tone: 'error' });
        return;
      }
      // La foto reemplazada o quitada se borra recién después de guardar la ronda.
      if (round?.photo) {
        for (const path of removedPhotos([round.photo], draft.photos)) {
          photoRepository.remove(path).catch(() => {});
        }
      }
      toast.show({ message: round ? 'Cambios guardados' : 'Ronda agregada' });
      // Una ronda nueva con foto sigue en su análisis; reemplaza al sheet, así que "Volver" desde
      // el análisis lleva al detalle de la sesión.
      if (!round && photo) navigate(`${listPath}/rondas/${id}/analisis`, { replace: true });
      else close();
    },
  });
  const { draft, errors, setField, touch } = form;
  const options = roundTargets(targets, draft.targetId);
  const target = targets.find((item) => item.id === draft.targetId);
  const max = roundMaxScore(target, draft.shots);
  const scoreHelp = [
    round?.score != null &&
      `El análisis calculó ${formatInteger(round.score)}; acá va el puntaje cargado a mano.`,
    max !== null && `Máximo: ${formatInteger(max)}.`,
  ]
    .filter(Boolean)
    .join(' ');

  async function handleDelete() {
    if (!round) return;
    setDeleting(true);
    const deleted = await deleteRound(session, round);
    setDeleting(false);
    setConfirming(false);
    if (deleted) close();
  }

  return (
    <>
      <InventorySheet
        title={round ? `Editar ronda · ${number}` : `Nueva ronda · ${number}`}
        eyebrow={formatShortDate(session.date)}
        submitLabel={round ? 'Guardar cambios' : 'Guardar ronda'}
        remove={
          round ? { label: 'Eliminar ronda', onRemove: () => setConfirming(true) } : undefined
        }
        dirty={form.dirty}
        saving={form.saving}
        errorAttempt={form.errorAttempt}
        onClose={close}
        onSubmit={form.submit}
      >
        <div className={styles.targetRow}>
          <Field label="Blanco" required error={errors.targetId}>
            <Select
              value={draft.targetId}
              onChange={(event) => setField('targetId', event.target.value)}
              onBlur={() => touch('targetId')}
              data-autofocus={draft.targetId ? undefined : true}
            >
              <option value="" disabled>
                Elegí el blanco
              </option>
              {options.map((item) => (
                <option key={item.id} value={item.id}>
                  {targetName(item)}
                  {item.archived ? ' (archivado)' : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Distancia" required error={errors.distance}>
            <Input
              value={draft.distance}
              onChange={(event) => setField('distance', event.target.value)}
              onBlur={() => touch('distance')}
              inputMode="decimal"
              autoComplete="off"
              suffix="m"
              placeholder="25"
              className="num"
            />
          </Field>
        </div>
        {!round && initial.distance && (
          <span className={styles.help}>
            Se precargan la distancia y los disparos de la ronda anterior.
          </span>
        )}
        {options.length === 0 && (
          <span className={styles.help}>No hay blancos. Cargalos en Inventario → Blancos.</span>
        )}

        <div className={styles.scoreRow}>
          <Field label="Disparos" kind="group" required error={errors.shots}>
            <Stepper
              value={draft.shots}
              onChange={(shots) => setField('shots', shots)}
              min={1}
              max={MAX_ROUND_SHOTS}
              decrementLabel="Restar un disparo"
              incrementLabel="Sumar un disparo"
            />
          </Field>
          <Field label="Puntaje" error={errors.manualScore} help={scoreHelp || undefined}>
            <Input
              value={draft.manualScore}
              onChange={(event) => setField('manualScore', event.target.value)}
              onBlur={() => touch('manualScore')}
              inputMode="numeric"
              autoComplete="off"
              className={styles.score}
            />
          </Field>
        </div>

        <Field
          label="Foto del blanco"
          kind="group"
          error={errors.photos}
          help={
            discardsAnalysis(round, draft)
              ? 'Cambiaste la foto o el blanco: al guardar se descarta el análisis de esta ronda.'
              : 'Con la foto vas a poder analizar los impactos y calcular el puntaje.'
          }
        >
          <PhotoPicker
            multiple={false}
            value={draft.photos}
            onChange={(photos) => setField('photos', photos)}
          />
        </Field>
        {/* Se analiza la foto ya guardada: con cambios sin guardar, primero hay que guardarlos. */}
        {round?.photo && !form.dirty && (
          <Link to={`${listPath}/rondas/${round.id}/analisis`} replace className={styles.analyze}>
            {round.analysis ? 'Ver análisis' : 'Analizar impactos'}
            <ChevronRight aria-hidden="true" size={18} />
          </Link>
        )}

        <Field label="Comentarios" error={errors.comments}>
          <Textarea
            value={draft.comments}
            onChange={(event) => setField('comments', event.target.value)}
            onBlur={() => touch('comments')}
            maxLength={COMMENTS_MAX_LENGTH}
            rows={2}
            placeholder="Ej: tirones abajo-izquierda"
          />
        </Field>
      </InventorySheet>

      <ConfirmDialog
        open={confirming}
        title={`¿Eliminar la ronda ${number}?`}
        description="Se borra también su foto. Vas a poder deshacerlo durante unos segundos."
        confirmLabel="Eliminar"
        loading={deleting}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
