import { useRef, type KeyboardEvent } from 'react';
import {
  calibrationTools,
  MARKER_LABELS,
  type CalibrationDraft,
  type CalibrationTool,
} from '@/lib/calibration';
import { cx } from '@/lib/cx';
import type { TargetScoring } from '@/lib/targets';
import styles from './marker-picker.module.css';

export interface MarkerPickerProps {
  scoring: TargetScoring;
  /** Para marcar con ✓ los puntos ya ubicados y la forma, si se deformó. */
  draft: CalibrationDraft;
  /** Lo que se ajusta con el próximo toque o arrastre sobre la foto. */
  active: CalibrationTool;
  onActive: (tool: CalibrationTool) => void;
  className?: string;
}

/**
 * Qué se ajusta de la calibración sobre la foto: centro, anillo y forma de los anillos, o centro,
 * A y B. Es un `radiogroup` navegable con las flechas, con los colores fijos de las
 * superposiciones.
 */
export function MarkerPicker({ scoring, draft, active, onActive, className }: MarkerPickerProps) {
  const markers = calibrationTools(scoring);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const current = markers.indexOf(active);
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = (current + delta + markers.length) % markers.length;
    const marker = markers[next];
    if (!marker) return;
    onActive(marker);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label="Qué ajustar" className={cx(styles.picker, className)}>
      {markers.map((marker, index) => {
        const checked = marker === active;
        return (
          <button
            key={marker}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={cx(styles.option, checked && styles.on)}
            onClick={() => onActive(marker)}
            onKeyDown={handleKeyDown}
          >
            {MARKER_LABELS[marker]}
            {(marker === 'shape' ? (draft.tilt ?? draft.shape) : draft[marker]) ? ' ✓' : ''}
          </button>
        );
      })}
    </div>
  );
}
