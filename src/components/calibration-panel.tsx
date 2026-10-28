import { useId } from 'react';
import type { CalibrationDraft, CalibrationTool } from '@/lib/calibration';
import { cx } from '@/lib/cx';
import { formatDecimal } from '@/lib/format';
import type { TargetZone } from '@/lib/target-zones';
import type { TargetScoring } from '@/lib/targets';
import { Button } from './button';
import { Card } from './card';
import { Field } from './field';
import { Input } from './input';
import { Select } from './select';
import styles from './calibration-panel.module.css';

const INSTRUCTIONS: Record<CalibrationTool, string> = {
  center: 'Tocá el centro del blanco.',
  edge: 'Tocá un punto sobre un anillo que se vea entero y elegí abajo cuál es. Los anillos verdes tienen que coincidir con los de la foto.',
  a: 'Tocá un punto de referencia, por ejemplo el borde izquierdo del blanco.',
  b: 'Tocá el segundo punto y escribí abajo la distancia real entre los dos.',
  shape:
    'Si la foto está en ángulo, mantené apretado y arrastrá: los anillos verdes se estiran o se achican hasta el dedo en esa dirección. Repetilo en otra dirección hasta que coincidan con los de la foto.',
};

export interface CalibrationPanelProps {
  scoring: TargetScoring;
  zones: readonly TargetZone[];
  draft: CalibrationDraft;
  /** Lo que se ajusta con el próximo toque sobre la foto (se elige sobre la foto). */
  active: CalibrationTool;
  onChange: (changes: Partial<CalibrationDraft>) => void;
  /** El centro del borrador se ubicó solo: se avisa que hay que revisarlo. */
  autoCenter?: boolean;
  /** Por qué todavía no se puede continuar (después de intentarlo). */
  error?: string;
  className?: string;
}

/**
 * Calibración de la foto: el centro y un anillo de diámetro conocido o, en los blancos sin zonas,
 * dos puntos a una distancia conocida. Los puntos se ubican tocando la foto.
 */
export function CalibrationPanel({
  scoring,
  zones,
  draft,
  active,
  onChange,
  autoCenter,
  error,
  className,
}: CalibrationPanelProps) {
  const titleId = useId();
  const rings = [...zones].sort((a, b) => b.diameterMm - a.diameterMm);
  return (
    <Card as="section" aria-labelledby={titleId} className={cx(styles.panel, className)}>
      <h2 id={titleId} className={cx('display', styles.title)}>
        Calibrar la foto
      </h2>
      <p className={styles.text}>
        {scoring === 'rings'
          ? 'Para medir en mm, ubicá sobre la foto el centro del blanco y un punto sobre un anillo.'
          : 'Para medir en mm, ubicá sobre la foto el centro del blanco y dos puntos a una distancia conocida.'}{' '}
        Con los botones de arriba de la foto elegís qué punto ubicar. Para ajustarlo, mantené
        apretado y arrastralo; para verlo de cerca, acercá la foto con dos dedos o con los botones
        de zoom. La foto tiene que estar sacada de frente.
      </p>
      <p role="status" className={styles.instruction}>
        {INSTRUCTIONS[active]}
      </p>
      {autoCenter && (
        <p className={styles.note}>
          El centro se ubicó automáticamente. Si no coincide con el de la foto, elegí «Centro» y
          tocalo.
        </p>
      )}
      {scoring === 'rings' && draft.shape && (
        <Button
          variant="ghost"
          className={styles.reset}
          onClick={() => onChange({ shape: undefined })}
        >
          Volver a círculos
        </Button>
      )}
      {scoring === 'rings' ? (
        <Field label="Anillo marcado" help="Por defecto, el más grande.">
          <Select
            value={String(draft.diameterMm)}
            onChange={(event) => onChange({ diameterMm: Number(event.target.value) })}
          >
            {rings.map((zone) => (
              <option key={zone.diameterMm} value={zone.diameterMm}>
                {zone.score} puntos · Ø {formatDecimal(zone.diameterMm)} mm
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <Field label="Distancia entre A y B" help="Por defecto, el ancho del blanco.">
          <Input
            value={draft.distance}
            onChange={(event) => onChange({ distance: event.target.value })}
            inputMode="decimal"
            autoComplete="off"
            suffix="mm"
            className="num"
          />
        </Field>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </Card>
  );
}
