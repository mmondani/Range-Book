import { cx } from '@/lib/cx';
import styles from './ammunition-comparison.module.css';

export interface AmmunitionComparisonItem {
  id: string;
  name: string;
  /** Puntaje por tiro; `null` si sus rondas no tienen puntaje. */
  average: number | null;
  /** «9,2 · 44,0 mm». */
  summary: string;
}

export interface AmmunitionComparisonProps {
  /** De mejor a peor promedio. */
  items: readonly AmmunitionComparisonItem[];
}

/** Barras horizontales del promedio por tiro de cada munición; la mejor ocupa todo el ancho. */
export function AmmunitionComparison({ items }: AmmunitionComparisonProps) {
  const best = Math.max(0, ...items.map((item) => item.average ?? 0));
  return (
    <ul className={styles.list}>
      {items.map((item, index) => (
        <li key={item.id} className={styles.item}>
          <div className={styles.row}>
            <span>{item.name}</span>
            <span className={cx('num', styles.summary)}>{item.summary}</span>
          </div>
          <div className={styles.track} aria-hidden="true">
            <div
              className={cx(styles.bar, index > 0 && styles.secondary)}
              style={{ width: `${best > 0 ? ((item.average ?? 0) / best) * 100 : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
