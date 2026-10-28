import { useRef, type KeyboardEvent } from 'react';
import {
  calibrationMarkers,
  MARKER_LABELS,
  type CalibrationDraft,
  type CalibrationMarker,
} from '@/lib/calibration';
import { cx } from '@/lib/cx';
import type { TargetScoring } from '@/lib/targets';
import styles from './marker-picker.module.css';

export interface MarkerPickerProps {
  scoring: TargetScoring;
  /** Para marcar con ✓ los puntos ya ubicados. */
  draft: CalibrationDraft;
  /** Marcador que se ubica con el próximo toque sobre la foto. */
  active: CalibrationMarker;
  onActive: (marker: CalibrationMarker) => void;
  className?: string;
}

/**
 * Qué punto de la calibración se ubica (centro y anillo, o centro, A y B), sobre la foto. Es un
 * `radiogroup` navegable con las flechas, con los colores fijos de las superposiciones.
 */
export function MarkerPicker({ scoring, draft, active, onActive, className }: MarkerPickerProps) {
  const markers = calibrationMarkers(scoring);
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
    <div role="radiogroup" aria-label="Punto a ubicar" className={cx(styles.picker, className)}>
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
            {draft[marker] ? ' ✓' : ''}
          </button>
        );
      })}
    </div>
  );
}
