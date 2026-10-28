import { CircleMinus, CirclePlus, WandSparkles } from 'lucide-react';
import { cx } from '@/lib/cx';
import styles from './analyzer-toolbar.module.css';

export type AnalyzerMode = 'add' | 'remove';

export interface AnalyzerToolbarProps {
  mode: AnalyzerMode;
  onMode: (mode: AnalyzerMode) => void;
  onDetect: () => void;
  detecting?: boolean;
  /** Mobile: "Detectar"; desktop: "Detectar automáticamente". */
  compact?: boolean;
  className?: string;
}

/** Modos del analizador: Detectar (acción) y Agregar / Quitar (excluyentes). */
export function AnalyzerToolbar({
  mode,
  onMode,
  onDetect,
  detecting = false,
  compact = false,
  className,
}: AnalyzerToolbarProps) {
  return (
    <div role="toolbar" aria-label="Modo de edición" className={cx(styles.toolbar, className)}>
      <button type="button" className={styles.button} onClick={onDetect} disabled={detecting}>
        <WandSparkles aria-hidden="true" />
        {compact ? 'Detectar' : 'Detectar automáticamente'}
      </button>
      <button
        type="button"
        aria-pressed={mode === 'add'}
        className={cx(styles.button, mode === 'add' && styles.on)}
        onClick={() => onMode('add')}
      >
        <CirclePlus aria-hidden="true" />
        Agregar
      </button>
      <button
        type="button"
        aria-pressed={mode === 'remove'}
        className={cx(styles.button, mode === 'remove' && styles.on)}
        onClick={() => onMode('remove')}
      >
        <CircleMinus aria-hidden="true" />
        Quitar
      </button>
    </div>
  );
}
