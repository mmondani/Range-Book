import { Minus, Plus } from 'lucide-react';
import { SCATTER_FULL_VIEW, stepZoom, zoomLabel, zoomLimits } from '@/lib/scatter-zoom';
import type { ZoomView } from '@/lib/zoom';
import styles from './scatter-zoom-controls.module.css';

export interface ScatterZoomControlsProps {
  view: ZoomView;
  onView: (view: ZoomView) => void;
}

/** − / nivel / + / 1×: la alternativa sin gestos al zoom de la dispersión. */
export function ScatterZoomControls({ view, onView }: ScatterZoomControlsProps) {
  const { canZoomOut, canZoomIn } = zoomLimits(view);
  return (
    <div role="group" aria-label="Zoom del gráfico" className={styles.controls}>
      <button
        type="button"
        aria-label="Alejar"
        className={styles.button}
        onClick={() => onView(stepZoom(view, -1))}
        disabled={!canZoomOut}
      >
        <Minus aria-hidden="true" size={18} />
      </button>
      <span aria-live="polite" className={styles.level}>
        {zoomLabel(view.scale)}
      </span>
      <button
        type="button"
        aria-label="Acercar"
        className={styles.button}
        onClick={() => onView(stepZoom(view, 1))}
        disabled={!canZoomIn}
      >
        <Plus aria-hidden="true" size={18} />
      </button>
      <button
        type="button"
        aria-label="Restablecer el zoom"
        className={styles.button}
        onClick={() => onView(SCATTER_FULL_VIEW)}
        disabled={!canZoomOut}
      >
        1×
      </button>
    </div>
  );
}
