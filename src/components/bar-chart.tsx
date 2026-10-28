import { useState } from 'react';
import { chartLayout, chartSummary } from '@/lib/chart';
import { ChartAxes } from './chart-axes';
import { ChartHitAreas } from './chart-hit-areas';
import { ChartValueLabel } from './chart-value-label';
import type { ChartProps } from './line-chart';
import styles from './chart.module.css';

/** Barras por sesión desde 0, con la última destacada (o la que se toca o se señala). */
export function BarChart({ title, points, width, height, formatTick }: ChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const layout = chartLayout(
    points.map((point) => point.value),
    { width, height, zero: true },
  );
  const current = active ?? points.length - 1;
  const barWidth = Math.min(30, layout.band * 0.6);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={chartSummary(title, points)}
      className={styles.chart}
      onPointerLeave={() => setActive(null)}
    >
      <ChartAxes layout={layout} points={points} formatTick={formatTick} baseline />
      {points.map((point, index) => {
        const y = layout.y(point.value);
        return (
          <rect
            key={point.key}
            x={layout.x(index) - barWidth / 2}
            y={y}
            width={barWidth}
            height={Math.max(layout.y(0) - y, 0)}
            rx={3}
            className={index === current ? styles.activeBar : styles.bar}
          />
        );
      })}
      <ChartValueLabel
        layout={layout}
        points={points}
        index={current}
        y={layout.y(points[current]?.value ?? 0)}
      />
      <ChartHitAreas layout={layout} points={points} onActive={setActive} />
    </svg>
  );
}
