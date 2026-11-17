import { useId } from 'react';
import { formatDecimal } from '@/lib/format';
import type { TracePoint, TraceSegment } from '@/lib/mantis-trace';
import styles from './mantis-trace.module.css';

export interface MantisTraceProps {
  points: readonly TracePoint[];
  segments: readonly TraceSegment[];
  /** Muestra del disparo (la ✕, en el origen). */
  shotIndex: number;
  /** Radio del círculo de referencia exterior, en mm (el interior es la mitad). */
  radius: number;
  /** Se dibuja hasta esta muestra (durante la reproducción). */
  upto: number;
  /** Lado del cuadro, en px. */
  size: number;
  /** Descripción para lectores de pantalla. */
  label: string;
  /** Texto de la esquina (el tiempo durante la reproducción). */
  time?: string;
}

/** Cuánto se agranda el cuadro respecto del círculo exterior. */
const MARGIN = 1.15;

/**
 * Trayectoria de un disparo, en mm y centrada en el disparo: apuntado (`--info`, 2 px), presión
 * del gatillo (`--warning`, 3 px) y seguimiento (`--accent`, 2 px punteado), con dos círculos de
 * referencia. Las fases se distinguen también por grosor y trazo, no solo por color. El
 * seguimiento puede salir del cuadro y se recorta.
 */
export function MantisTrace({
  points,
  segments,
  shotIndex,
  radius,
  upto,
  size,
  label,
  time,
}: MantisTraceProps) {
  const clipId = useId();
  const view = radius * MARGIN;
  // Unidades del gráfico por px de pantalla (para los textos y la ✕).
  const px = (2 * view) / size;
  const last = points.length - 1;
  const current = upto < last ? points[Math.max(0, upto)] : undefined;
  const cross = 6 * px;

  return (
    <div className={styles.frame} style={{ width: size, height: size }}>
      <svg
        role="img"
        aria-label={label}
        width={size}
        height={size}
        viewBox={`${-view} ${-view} ${2 * view} ${2 * view}`}
        className={styles.svg}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={-view} y={-view} width={2 * view} height={2 * view} />
          </clipPath>
        </defs>
        <line x1={-view} y1={0} x2={view} y2={0} className={styles.axis} />
        <line x1={0} y1={-view} x2={0} y2={view} className={styles.axis} />
        {[radius / 2, radius].map((r) => (
          <g key={r}>
            <circle r={r} className={styles.ring} />
            <text
              x={r * Math.SQRT1_2 + 3 * px}
              y={-r * Math.SQRT1_2 - 3 * px}
              fontSize={12 * px}
              className={styles.ringLabel}
            >
              {formatDecimal(r)} mm
            </text>
          </g>
        ))}
        <g clipPath={`url(#${clipId})`}>
          {segments.map((segment) => {
            const end = Math.min(segment.to, upto);
            if (end <= segment.from) return null;
            let d = '';
            for (let index = segment.from; index <= end; index++) {
              const point = points[index];
              if (point) d += `${d ? 'L' : 'M'}${point.x.toFixed(2)} ${(-point.y).toFixed(2)}`;
            }
            return <path key={segment.phase} d={d} className={styles[segment.phase]} />;
          })}
          {current && (
            <circle
              cx={current.x}
              cy={-current.y}
              r={5 * px}
              strokeWidth={2 * px}
              className={styles.cursor}
            />
          )}
        </g>
        {upto >= shotIndex && (
          <path
            d={`M${-cross} ${-cross}L${cross} ${cross}M${cross} ${-cross}L${-cross} ${cross}`}
            className={styles.shot}
          />
        )}
      </svg>
      {time && <span className={`num ${styles.time}`}>{time}</span>}
    </div>
  );
}
