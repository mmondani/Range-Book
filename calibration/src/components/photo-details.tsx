import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Textarea } from '@/components/textarea';
import {
  CONDITION_LABELS,
  PHOTO_CONDITIONS,
  type DatasetPhoto,
  type DatasetTarget,
  type PhotoChanges,
} from '../lib/dataset';
import styles from './tool.module.css';

export interface PhotoDetailsProps {
  photo: DatasetPhoto;
  targets: readonly DatasetTarget[];
  onChange: (changes: PhotoChanges) => void;
  onStatus: (status: 'done' | 'discarded' | 'open') => void;
}

function parseShots(value: string): number | null {
  const text = value.trim();
  return /^\d+$/.test(text) && Number(text) > 0 ? Number(text) : null;
}

/** Datos de la foto (calibre, blanco, disparos, condiciones, notas) y su estado. */
export function PhotoDetails({ photo, targets, onChange, onStatus }: PhotoDetailsProps) {
  return (
    <section aria-label="Datos de la foto" className={styles.panel}>
      <div className={styles.row}>
        {photo.status === 'done' || photo.status === 'discarded' ? (
          <Button onClick={() => onStatus('open')}>
            {photo.status === 'done' ? 'Volver a abrir' : 'Recuperar'}
          </Button>
        ) : (
          <>
            <Button variant="primary" onClick={() => onStatus('done')}>
              Marcar como lista
            </Button>
            <Button variant="ghost" onClick={() => onStatus('discarded')}>
              Descartar
            </Button>
          </>
        )}
      </div>
      <Field label="Blanco">
        <Select
          value={photo.targetId ?? ''}
          onChange={(event) => onChange({ targetId: event.target.value || null })}
        >
          <option value="">Elegí el blanco</option>
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Calibre" help="Como en el inventario: 9×19 mm, .22 LR…">
        <Input
          value={photo.caliber}
          onChange={(event) => onChange({ caliber: event.target.value })}
          autoComplete="off"
        />
      </Field>
      <Field label="Disparos de la ronda">
        <Input
          value={photo.shots ?? ''}
          onChange={(event) => onChange({ shots: parseShots(event.target.value) })}
          inputMode="numeric"
          autoComplete="off"
          className="num"
        />
      </Field>
      <fieldset className={styles.checks}>
        <legend>Condiciones de la foto</legend>
        {PHOTO_CONDITIONS.map((condition) => (
          <label key={condition} className={styles.check}>
            <input
              type="checkbox"
              checked={photo.conditions.includes(condition)}
              onChange={(event) =>
                onChange({
                  conditions: event.target.checked
                    ? [...photo.conditions, condition]
                    : photo.conditions.filter((item) => item !== condition),
                })
              }
            />
            {CONDITION_LABELS[condition]}
          </label>
        ))}
      </fieldset>
      <Field label="Notas">
        <Textarea
          value={photo.notes}
          onChange={(event) => onChange({ notes: event.target.value })}
        />
      </Field>
    </section>
  );
}
