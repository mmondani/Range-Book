import { labelIndexes, type ChartLayout, type ChartPoint } from '@/lib/chart';
import { formatDayMonth } from '@/lib/format';
import styles from './chart.module.css';

export interface ChartAxesProps {
  layout: ChartLayout;
  points: readonly ChartPoint[];
  formatTick: (value: number) => string;
  /** Dibuja la marca del 0 como eje (barras). */
  baseline?: boolean;
}

/** Grilla tenue, marcas del eje y y fechas del primer, del medio y del último punto. */
export function ChartAxes({ layout, points, formatTick, baseline = false }: ChartAxesProps) {
  return (
    <g aria-hidden="true">
      {layout.ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={layout.left}
            x2={layout.right}
            y1={layout.y(tick)}
            y2={layout.y(tick)}
            className={baseline && tick === 0 ? styles.baseline : styles.grid}
          />
          <text
            x={layout.left - 6}
            y={layout.y(tick) + 4}
            textAnchor="end"
            className={styles.axisLabel}
          >
            {formatTick(tick)}
          </text>
        </g>
      ))}
      {labelIndexes(points.length).map((index) => (
        <text
          key={index}
          x={layout.x(index)}
          y={layout.height - 6}
          textAnchor="middle"
          className={styles.axisLabel}
        >
          {formatDayMonth(points[index]!.date)}
        </text>
      ))}
    </g>
  );
}
