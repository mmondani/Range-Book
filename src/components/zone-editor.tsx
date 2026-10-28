import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { parseDecimal } from '@/lib/format';
import { generateZones, MAX_ZONES, type TargetZone, type ZoneErrors } from '@/lib/target-zones';
import { zoneDraft, type ZoneDraft } from '@/lib/targets';
import { Button } from './button';
import { Field } from './field';
import { FieldContext } from './field-context';
import { IconButton } from './icon-button';
import { Input } from './input';
import { TargetThumb } from './target-thumb';
import styles from './zone-editor.module.css';

const DEFAULT_COUNT = '10';

export interface ZoneEditorProps {
  zones: ZoneDraft[];
  onChange: (zones: ZoneDraft[]) => void;
  /** Diámetro de la zona exterior, si es válido: hace falta para "Generar". */
  referenceMm?: number;
  /** Errores de cada fila (después de intentar guardar). */
  rowErrors?: readonly ZoneErrors[];
  /** Error del conjunto (por ejemplo, "Agregá al menos una zona"). */
  error?: string;
}

/** Zonas con valores válidos, para la vista previa. */
function previewZones(zones: readonly ZoneDraft[]): TargetZone[] {
  return zones.flatMap((zone) => {
    const diameterMm = parseDecimal(zone.diameter);
    return diameterMm ? [{ score: Number(zone.score) || 0, diameterMm }] : [];
  });
}

/** M12 · Zonas de puntaje: filas puntaje + diámetro, "Generar" anillos uniformes y vista previa. */
export function ZoneEditor({ zones, onChange, referenceMm, rowErrors, error }: ZoneEditorProps) {
  const id = useId();
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [countError, setCountError] = useState<string>();
  /** Zona recién agregada: su puntaje recibe el foco después de renderizarla. */
  const focusKey = useRef<string>(undefined);
  const zonesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusKey.current) return;
    zonesRef.current
      ?.querySelector<HTMLInputElement>(`[data-zone="${focusKey.current}"] input`)
      ?.focus();
    focusKey.current = undefined;
  });

  function generate() {
    const value = Number(count.trim());
    if (!Number.isInteger(value) || value < 1 || value > MAX_ZONES) {
      setCountError(`Entre 1 y ${MAX_ZONES}`);
      return;
    }
    if (referenceMm === undefined) {
      setCountError('Primero ingresá el diámetro de la zona exterior');
      return;
    }
    setCountError(undefined);
    onChange(generateZones(referenceMm, value).map(zoneDraft));
  }

  function update(key: string, field: 'score' | 'diameter', value: string) {
    onChange(zones.map((zone) => (zone.key === key ? { ...zone, [field]: value } : zone)));
  }

  function add() {
    const zone = zoneDraft();
    onChange([...zones, zone]);
    focusKey.current = zone.key;
  }

  return (
    <div className={styles.editor}>
      <div className={styles.top}>
        <Field label="Cantidad de zonas" error={countError} className={styles.count}>
          <div className={styles.generate}>
            <Input
              value={count}
              onChange={(event) => {
                setCount(event.target.value);
                setCountError(undefined);
              }}
              inputMode="numeric"
              autoComplete="off"
              className={`num ${styles.countInput}`}
            />
            <Button variant="ghost" onClick={generate} className={styles.generateButton}>
              Generar
            </Button>
          </div>
        </Field>
        <figure className={styles.preview}>
          <TargetThumb scoring="rings" zones={previewZones(zones)} className={styles.thumb} />
          <figcaption className={styles.caption}>Vista previa</figcaption>
        </figure>
      </div>

      <Field
        label="Zonas de puntaje"
        kind="group"
        error={error}
        help="Un impacto suma el puntaje de la zona más chica que lo contiene."
      >
        {/* Cada fila tiene sus propias etiquetas y errores: no hereda los del Field. */}
        <FieldContext.Provider value={null}>
          <div ref={zonesRef} role="group" aria-label="Zonas de puntaje" className={styles.zones}>
            {zones.length > 0 && (
              <div className={styles.head} aria-hidden="true">
                <span>Puntaje</span>
                <span>Diámetro (mm)</span>
              </div>
            )}
            {zones.map((zone, index) => {
              const number = index + 1;
              const errors = rowErrors?.[index] ?? {};
              const scoreErrorId = errors.score ? `${id}-${zone.key}-score` : undefined;
              const diameterErrorId = errors.diameter ? `${id}-${zone.key}-diameter` : undefined;
              return (
                <div key={zone.key} data-zone={zone.key} className={styles.zone}>
                  <div className={styles.row}>
                    <Input
                      aria-label={`Puntaje de la zona ${number}`}
                      aria-invalid={errors.score ? true : undefined}
                      aria-describedby={scoreErrorId}
                      value={zone.score}
                      onChange={(event) => update(zone.key, 'score', event.target.value)}
                      inputMode="numeric"
                      autoComplete="off"
                      className={`num ${styles.input}`}
                    />
                    <Input
                      aria-label={`Diámetro de la zona ${number} en mm`}
                      aria-invalid={errors.diameter ? true : undefined}
                      aria-describedby={diameterErrorId}
                      value={zone.diameter}
                      onChange={(event) => update(zone.key, 'diameter', event.target.value)}
                      inputMode="decimal"
                      autoComplete="off"
                      className={`num ${styles.input}`}
                    />
                    <IconButton
                      aria-label={`Quitar la zona ${number}`}
                      onClick={() => onChange(zones.filter((other) => other.key !== zone.key))}
                      className={styles.remove}
                    >
                      <Trash2 aria-hidden="true" size={18} />
                    </IconButton>
                  </div>
                  {(errors.score || errors.diameter) && (
                    <div className={styles.rowErrors}>
                      {errors.score && <span id={scoreErrorId}>{errors.score}</span>}
                      {errors.diameter && <span id={diameterErrorId}>{errors.diameter}</span>}
                    </div>
                  )}
                </div>
              );
            })}
            <Button variant="ghost" onClick={add} className={styles.add}>
              <Plus aria-hidden="true" size={18} />
              Agregar zona
            </Button>
          </div>
        </FieldContext.Provider>
      </Field>
    </div>
  );
}
