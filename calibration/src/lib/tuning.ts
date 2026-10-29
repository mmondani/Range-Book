import { parseDecimal } from '@/lib/format';
import { DEFAULT_TUNING, type DetectionTuning } from '@/lib/impact-detection';

export type TuningKey = keyof DetectionTuning;

/** Parámetros de la detección que se pueden cambiar en la evaluación, en orden. */
export const TUNING_FIELDS: ReadonlyArray<{ key: TuningKey; label: string; help: string }> = [
  {
    key: 'threshold',
    label: 'Umbral de brillo',
    help: 'Diferencia mínima contra el entorno (0–255).',
  },
  { key: 'windowRatio', label: 'Ventana del entorno', help: 'Radio, en agujeros.' },
  { key: 'erosionDivisor', label: 'Erosión', help: 'Radio de 1/N de agujero.' },
  { key: 'minAreaRatio', label: 'Área mínima', help: 'Veces el área de un agujero.' },
  { key: 'maxAreaRatio', label: 'Área máxima', help: 'Veces el área de un agujero.' },
  { key: 'maxSideRatio', label: 'Lado máximo', help: 'Diámetros de agujero.' },
  { key: 'minFill', label: 'Ocupación mínima', help: 'Fracción del rectángulo (0–1).' },
];

export type TuningValues = Record<TuningKey, string>;

/** Valores del formulario, como se escriben (los de la app por defecto). */
export function tuningValues(tuning: DetectionTuning = DEFAULT_TUNING): TuningValues {
  return Object.fromEntries(
    // Sin redondear (`formatDecimal` deja un decimal): 0,35 tiene que seguir siendo 0,35.
    TUNING_FIELDS.map(({ key }) => [key, String(tuning[key]).replace('.', ',')]),
  ) as TuningValues;
}

/** Parámetros del formulario, o qué campos no son un número mayor que 0. */
export function parseTuning(
  values: TuningValues,
): { tuning: DetectionTuning } | { errors: TuningKey[] } {
  const tuning = { ...DEFAULT_TUNING };
  const errors: TuningKey[] = [];
  for (const { key } of TUNING_FIELDS) {
    const value = parseDecimal(values[key]);
    if (value === undefined || !(value > 0)) errors.push(key);
    else tuning[key] = value;
  }
  return errors.length ? { errors } : { tuning };
}
