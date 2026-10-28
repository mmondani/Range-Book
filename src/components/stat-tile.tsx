import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './stat-tile.module.css';

export interface StatTileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  /** Texto de ayuda o delta debajo del número. */
  help?: ReactNode;
  /** Colorea la ayuda como delta positivo o negativo (además del texto). */
  trend?: 'up' | 'down';
  /** `sm` para que entren tres por fila en mobile. */
  size?: 'sm' | 'md' | 'lg';
  accent?: boolean;
  className?: string;
}

export function StatTile({
  label,
  value,
  unit,
  help,
  trend,
  size = 'md',
  accent = false,
  className,
}: StatTileProps) {
  return (
    <div
      className={cx(styles.tile, size !== 'md' && styles[size], accent && styles.accent, className)}
    >
      <span className="eyebrow">{label}</span>
      <span className={styles.value}>
        <span className={cx('display num', styles.number)}>{value}</span>
        {unit && <span className={styles.unit}>{unit}</span>}
      </span>
      {help && <span className={cx(styles.help, trend && styles[trend])}>{help}</span>}
    </div>
  );
}
