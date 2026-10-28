import { cx } from '@/lib/cx';
import { Card } from './card';
import { StatTile, type StatTileProps } from './stat-tile';
import styles from './metric-tile.module.css';

/** Métrica del análisis en una tarjeta: tamaño de grupo, desvío del PMI, distancia al centro. */
export function MetricTile({ className, ...rest }: StatTileProps) {
  return (
    <Card className={cx(styles.tile, className)}>
      <StatTile {...rest} />
    </Card>
  );
}
