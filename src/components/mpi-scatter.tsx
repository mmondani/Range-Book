import { scatterRings } from '@/lib/chart';
import type { TargetPoint } from '@/lib/target-zones';
import styles from './mpi-scatter.module.css';

export interface MpiScatterPoint extends TargetPoint {
  key: string;
  /** Lo que va dentro del punto: el número de la ronda. */
  label: string;
}

export interface MpiScatterProps {
  /** PMI de cada ronda, en orden, ya en la unidad que se muestra (x a la derecha, y hacia arriba). */
  points: readonly MpiScatterPoint[];
  /** `mm`, `in` o `MOA`. */
  unit: string;
  format: (value: number) => string;
  /** Resumen para lectores de pantalla. */
  title: string;
}

const SIZE = 240;
const CENTER = SIZE / 2;
/** Margen para que los puntos del borde entren enteros. */
const MARGIN = 20;

/**
 * Dispersión de los PMI de cada ronda alrededor del centro del blanco: ejes, dos círculos de
 * referencia con su medida, el recorrido de ronda en ronda y la última ronda resaltada.
 */
export function MpiScatter({ points, unit, format, title }: MpiScatterProps) {
  const farthest = Math.max(0, ...points.map((point) => Math.hypot(point.x, point.y)));
  const rings = scatterRings(farthest);
  const scale = (CENTER - MARGIN) / rings[1];
  const position = ({ x, y }: TargetPoint) => ({ cx: CENTER + x * scale, cy: CENTER - y * scale });
  const last = points.length - 1;
  const summary = `${title}: ${points
    .map((point) => `${point.label} (${format(point.x)}; ${format(point.y)})`)
    .join(', ')} ${unit}`;

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={summary} className={styles.scatter}>
      <g aria-hidden="true">
        {rings.map((radius) => (
          <g key={radius}>
            <circle cx={CENTER} cy={CENTER} r={radius * scale} className={styles.ring} />
            <text
              x={CENTER + radius * scale * Math.SQRT1_2 + 3}
              y={CENTER - radius * scale * Math.SQRT1_2 - 3}
              className={styles.ringLabel}
            >
              {`${format(radius)} ${unit}`}
            </text>
          </g>
        ))}
        <line
          x1={MARGIN / 2}
          x2={SIZE - MARGIN / 2}
          y1={CENTER}
          y2={CENTER}
          className={styles.axis}
        />
        <line
          x1={CENTER}
          x2={CENTER}
          y1={MARGIN / 2}
          y2={SIZE - MARGIN / 2}
          className={styles.axis}
        />
        <polyline
          points={points
            .map(position)
            .map(({ cx, cy }) => `${cx},${cy}`)
            .join(' ')}
          className={styles.path}
        />
        {points.map((point, index) => {
          const { cx, cy } = position(point);
          return (
            <g key={point.key} className={index === last ? styles.last : styles.point}>
              <circle cx={cx} cy={cy} r={index === last ? 11 : 9} />
              <text x={cx} y={cy + 4} textAnchor="middle">
                {point.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
