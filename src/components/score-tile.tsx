import { useId, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { formatInteger } from '@/lib/format';
import type { AnalysisMetrics } from '@/lib/metrics';
import { Card } from './card';
import styles from './score-tile.module.css';

export interface ScoreTileProps {
  metrics: Pick<AnalysisMetrics, 'score' | 'maxScore' | 'averageScore' | 'distribution'>;
  /** Debajo de la distribución (en desktop, la confirmación del puntaje). */
  children?: ReactNode;
  className?: string;
}

const averageFormat = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Puntaje calculado: total / máximo, promedio por impacto y distribución por zona. */
export function ScoreTile({ metrics, children, className }: ScoreTileProps) {
  const { score, maxScore, averageScore, distribution } = metrics;
  const distributionId = useId();
  return (
    <Card className={cx(styles.card, className)}>
      <div className={styles.top}>
        <div className={styles.stat}>
          <span className="eyebrow">Puntaje</span>
          <span className={cx('display num', styles.score)}>
            {score === null ? '—' : formatInteger(score)}
            {maxScore !== null && <span className={styles.max}> / {formatInteger(maxScore)}</span>}
          </span>
        </div>
        <div className={cx(styles.stat, styles.end)}>
          <span className="eyebrow">Prom./tiro</span>
          <span className={cx('display num', styles.average)}>
            {averageScore === null ? '—' : averageFormat.format(averageScore)}
          </span>
        </div>
      </div>
      {distribution.length > 0 && (
        <div className={styles.stat}>
          <span className="eyebrow" id={distributionId}>
            Distribución por zona
          </span>
          <ul className={styles.distribution} aria-labelledby={distributionId}>
            {distribution.map(({ score: zone, count }) => (
              <li key={zone} className={styles.zone}>
                <b>{zone === 0 ? 'Fuera' : zone}</b>
                <span className="num">× {count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {children}
    </Card>
  );
}
