import { useLayoutEffect, useState } from 'react';
import { useElementWidth } from '@/hooks/use-element-width';
import {
  axisLabelIndexes,
  chartLayout,
  chartSummary,
  chartWidth,
  type ChartPoint,
} from '@/lib/chart';
import { cx } from '@/lib/cx';
import { ChartHitAreas } from './chart-hit-areas';
import { ChartYAxis } from './chart-y-axis';
import styles from './chart.module.css';

export interface LineChartProps {
  /** Para el resumen accesible. */
  title: string;
  points: readonly ChartPoint[];
  height: number;
  formatTick: (value: number) => string;
  /** Qué es cada punto, en plural, para el resumen accesible ("sesiones", "rondas"). */
  noun?: string;
}

/**
 * Línea con el valor de cada punto. El último (o el que se toca o se señala) se destaca y muestra
 * su fecha o ronda. Si los puntos no entran, el gráfico se desplaza en horizontal, arranca
 * mostrando los más recientes y el eje y queda fijo.
 */
export function LineChart({ title, points, height, formatTick, noun }: LineChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const [scrollerRef, available] = useElementWidth<HTMLDivElement>();
  const width = chartWidth(points.length, available);
  const layout = chartLayout(
    points.map((point) => point.value),
    { width, height },
  );
  const current = active ?? points.length - 1;
  const coordinates = points.map((point, index) => ({
    x: layout.x(index),
    y: layout.y(point.value),
  }));

  // Arranca mostrando los puntos más recientes.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
  }, [scrollerRef, width, points.length]);

  return (
    <div className={styles.frame}>
      <ChartYAxis layout={layout} formatTick={formatTick} />
      <div
        ref={scrollerRef}
        className={styles.scroller}
        // Si se desplaza, también con el teclado (el nombre lo lleva el gráfico de adentro). Un
        // contenedor que se desplaza tiene que poder enfocarse (WCAG 2.1.1), aunque no sea un control.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={width > available ? 0 : undefined}
      >
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={chartSummary(title, points, noun)}
          className={styles.chart}
          onPointerLeave={() => setActive(null)}
        >
          <g aria-hidden="true">
            {layout.ticks.map((tick) => (
              <line
                key={tick}
                x1={0}
                x2={width}
                y1={layout.y(tick)}
                y2={layout.y(tick)}
                className={styles.grid}
              />
            ))}
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
            {coordinates.map(({ x, y }, index) => (
              <text
                key={points[index]!.key}
                x={x}
                y={Math.max(y - 12, 14)}
                textAnchor="middle"
                className={cx(styles.valueLabel, index === current && styles.activeLabel)}
              >
                {points[index]!.label}
              </text>
            ))}
            {axisLabelIndexes(points.length, layout.band, current).map((index) => (
              <text
                key={points[index]!.key}
                x={layout.x(index)}
                y={height - 6}
                textAnchor="middle"
                className={cx(styles.axisLabel, index === current && styles.activeLabel)}
              >
                {points[index]!.axisLabel}
              </text>
            ))}
          </g>
          <ChartHitAreas layout={layout} points={points} onActive={setActive} />
        </svg>
      </div>
    </div>
  );
}
