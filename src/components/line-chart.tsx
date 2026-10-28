import { useState } from 'react';
import { chartLayout, chartSummary, type ChartPoint } from '@/lib/chart';
import { ChartAxes } from './chart-axes';
import { ChartHitAreas } from './chart-hit-areas';
import { ChartValueLabel } from './chart-value-label';
import styles from './chart.module.css';

export interface ChartProps {
  /** Para el resumen accesible. */
  title: string;
  points: readonly ChartPoint[];
  width: number;
  height: number;
  formatTick: (value: number) => string;
}

/** Línea por sesión con el último punto destacado (o el que se toca o se señala). */
export function LineChart({ title, points, width, height, formatTick }: ChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const layout = chartLayout(
    points.map((point) => point.value),
    { width, height },
  );
  const current = active ?? points.length - 1;
  const coordinates = points.map((point, index) => ({
    x: layout.x(index),
    y: layout.y(point.value),
  }));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={chartSummary(title, points)}
      className={styles.chart}
      onPointerLeave={() => setActive(null)}
    >
      <ChartAxes layout={layout} points={points} formatTick={formatTick} />
      <polyline
        className={styles.line}
        points={coordinates.map(({ x, y }) => `${x},${y}`).join(' ')}
      />
      {coordinates.map(({ x, y }, index) => (
        <circle
          key={points[index]!.key}
          cx={x}
          cy={y}
          r={index === current ? 5.5 : 3.5}
          className={index === current ? styles.activeDot : styles.dot}
        />
      ))}
      <ChartValueLabel
        layout={layout}
        points={points}
        index={current}
        y={coordinates[current]?.y ?? 0}
      />
      <ChartHitAreas layout={layout} points={points} onActive={setActive} />
    </svg>
  );
}
