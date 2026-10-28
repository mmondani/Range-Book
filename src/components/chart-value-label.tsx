import type { ChartLayout, ChartPoint } from '@/lib/chart';
import { formatDayMonth } from '@/lib/format';
import styles from './chart.module.css';

export interface ChartValueLabelProps {
  layout: ChartLayout;
  points: readonly ChartPoint[];
  index: number;
  /** Altura del tope del punto o de la barra. */
  y: number;
}

/** Valor del punto destacado, arriba de él. Si no es el último, suma la fecha. */
export function ChartValueLabel({ layout, points, index, y }: ChartValueLabelProps) {
  const point = points[index];
  if (!point) return null;
  const x = layout.x(index);
  // Cerca de los bordes, el texto se alinea hacia adentro para no salirse.
  const anchor = x - layout.left < 48 ? 'start' : layout.right - x < 48 ? 'end' : 'middle';
  return (
    <text
      x={anchor === 'start' ? x - 6 : anchor === 'end' ? x + 6 : x}
      y={Math.max(y - 12, 14)}
      textAnchor={anchor}
      className={styles.valueLabel}
      aria-hidden="true"
    >
      {index === points.length - 1 ? point.label : `${point.label} · ${formatDayMonth(point.date)}`}
    </text>
  );
}
