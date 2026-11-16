import { cx } from '@/lib/cx';
import { formatFixed } from '@/lib/format';
import type { MantisShot } from '@/lib/mantis';
import { problemLabel } from '@/lib/mantis-problems';
import { angleClock, shotDescription, type MantisStats } from '@/lib/mantis-trace';
import { Badge } from './badge';
import { Card } from './card';
import styles from './mantis-shot-list.module.css';

export interface MantisShotListProps {
  shots: readonly MantisShot[];
  stats: MantisStats;
  selected: number;
  onSelect: (index: number) => void;
}

/**
 * Disparos de la sesión de MantisX: una fila-botón por disparo (`aria-pressed`) con el puntaje, el
 * split, el diagnóstico, la dirección del desvío y los badges de los extremos.
 */
export function MantisShotList({ shots, stats, selected, onSelect }: MantisShotListProps) {
  return (
    <Card padded={false} className={styles.list}>
      {shots.map((shot, index) => {
        const badges = [
          index === stats.best && (
            <Badge key="best" tone="success">
              Mejor
            </Badge>
          ),
          index === stats.worst && (
            <Badge key="worst" tone="warning">
              Peor
            </Badge>
          ),
          index === stats.fastest && (
            <Badge key="fast" tone="info">
              Split más rápido
            </Badge>
          ),
          index === stats.slowest && (
            <Badge key="slow" tone="neutral">
              Split más lento
            </Badge>
          ),
        ].filter(Boolean);
        const clock = angleClock(shot.angle);
        return (
          <button
            key={shot.pk}
            type="button"
            aria-pressed={index === selected}
            aria-label={shotDescription(shot, index)}
            className={styles.row}
            onClick={() => onSelect(index)}
          >
            <span className={cx('display num', styles.number)}>{index + 1}</span>
            <span className={styles.body}>
              <span className={styles.top}>
                <span className={cx('display num', styles.score)}>
                  {formatFixed(shot.score, 1)}
                </span>
                <span className={cx('num', styles.split)}>
                  {index === 0 ? 'Primer disparo' : `Split ${formatFixed(shot.split, 2)} s`}
                </span>
              </span>
              <span className={styles.problem}>{problemLabel(shot.problem)}</span>
              {badges.length > 0 && <span className={styles.badges}>{badges}</span>}
            </span>
            <span className={styles.direction} title="Dirección">
              <svg viewBox="-12 -12 24 24" width={28} height={28} aria-hidden="true">
                <circle r={10.5} className={styles.dial} />
                <g transform={`rotate(${-shot.angle})`}>
                  <path d="M-5 0H6M2.5 -3.5 6 0 2.5 3.5" className={styles.arrow} />
                </g>
              </svg>
              <span className={cx('num', styles.clock)}>{clock} h</span>
            </span>
          </button>
        );
      })}
    </Card>
  );
}
