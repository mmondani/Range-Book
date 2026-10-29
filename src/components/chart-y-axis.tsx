import { Y_AXIS_WIDTH, type ChartLayout } from '@/lib/chart';
import styles from './chart.module.css';

export interface ChartYAxisProps {
  layout: ChartLayout;
  formatTick: (value: number) => string;
}

/** Marcas del eje y, en un SVG aparte que queda fijo mientras el gráfico se desplaza. */
export function ChartYAxis({ layout, formatTick }: ChartYAxisProps) {
  return (
    <svg width={Y_AXIS_WIDTH} height={layout.height} className={styles.yAxis} aria-hidden="true">
      {layout.ticks.map((tick) => (
        <text
          key={tick}
          x={Y_AXIS_WIDTH - 6}
          y={layout.y(tick) + 4}
          textAnchor="end"
          className={styles.axisLabel}
        >
          {formatTick(tick)}
        </text>
      ))}
    </svg>
  );
}
