import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { usePinchZoom } from '@/hooks/use-pinch-zoom';
import { scatterExtent, scatterRings } from '@/lib/chart';
import { cx } from '@/lib/cx';
import { SCATTER_FULL_VIEW, visibleRings, zoomedPosition } from '@/lib/scatter-zoom';
import type { TargetPoint } from '@/lib/target-zones';
import { isZoomed, type ZoomView } from '@/lib/zoom';
import { ScatterZoomControls } from './scatter-zoom-controls';
import styles from './mpi-scatter.module.css';

export interface MpiScatterPoint extends TargetPoint {
  key: string;
  /** Lo que va dentro del punto: el número de la ronda. */
  label: string;
  /** Círculo centrado en el PMI (el grupo o el radio medio de la ronda), en la misma unidad. */
  radius?: number | null;
  /** Lo que se agrega al resumen accesible del punto ("grupo 46"). */
  detail?: string;
}

export interface MpiScatterProps {
  /** PMI de cada ronda, en orden, ya en la unidad que se muestra (x a la derecha, y hacia arriba). */
  points: readonly MpiScatterPoint[];
  /** `mm`, `in` o `MOA`. */
  unit: string;
  format: (value: number) => string;
  /** Resumen para lectores de pantalla. */
  title: string;
  /** La ronda seleccionada: se resalta y las demás se opacan. */
  selectedKey?: string | null;
  /** Con esto, los puntos se pueden tocar para seleccionar su ronda (o quitarla, con `null`). */
  onSelect?: (key: string | null) => void;
}

const SIZE = 240;
const CENTER = SIZE / 2;
/** Margen para que los puntos del borde entren enteros. */
const MARGIN = 20;
/** Radio del área de toque: 44 px con el gráfico a su ancho máximo (280 px). */
const HIT_RADIUS = 19;

/**
 * Dispersión de los PMI de cada ronda alrededor del centro del blanco: ejes, dos círculos de
 * referencia con su medida, el recorrido de ronda en ronda y la última ronda resaltada. Cada
 * ronda puede llevar un círculo (su grupo o su radio medio). Con `onSelect`, tocar un punto lo
 * selecciona, y el gráfico se acerca con dos dedos, con Ctrl + rueda o con sus botones.
 */
export function MpiScatter({
  points,
  unit,
  format,
  title,
  selectedKey = null,
  onSelect,
}: MpiScatterProps) {
  const [view, setView] = useState<ZoomView>(SCATTER_FULL_VIEW);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoom = usePinchZoom(svgRef, view, setView);
  const clipId = useId();
  const extent = scatterExtent(points);
  const scale = (CENTER - MARGIN) / scatterRings(extent)[1];
  const rings = visibleRings(extent, view.scale);
  const zoomed = isZoomed(view);
  const position = ({ x, y }: TargetPoint) => {
    const at = zoomedPosition({ x: CENTER + x * scale, y: CENTER - y * scale }, view, SIZE);
    return { cx: at.x, cy: at.y };
  };
  const origin = position({ x: 0, y: 0 });
  const last = points.length - 1;
  const selected = points.findIndex((point) => point.key === selectedKey);
  const hasSelection = selected !== -1;
  const summary = `${title}: ${points
    .map(
      (point) =>
        `${point.label} (${format(point.x)}; ${format(point.y)})${point.detail ? ` ${point.detail}` : ''}`,
    )
    .join(', ')} ${unit}`;

  const toggle = (key: string) => onSelect?.(key === selectedKey ? null : key);
  const onKeyDown = (event: KeyboardEvent, key?: string) => {
    if (event.key === 'Escape' && onSelect) {
      onSelect(null);
      return;
    }
    if (key && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      toggle(key);
    }
  };

  // El seleccionado se dibuja último, arriba de los demás.
  const order = points.map((_, index) => index);
  if (hasSelection) order.push(...order.splice(selected, 1));

  return (
    <div className={styles.wrapper}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role={onSelect ? 'group' : 'img'}
        aria-label={summary}
        className={cx(styles.scatter, onSelect && styles.interactive, zoomed && styles.zoomed)}
        style={{ touchAction: onSelect ? zoom.touchAction : undefined }}
        {...(onSelect ? zoom.handlers : {})}
        onClick={onSelect ? () => !zoom.wasGesture() && onSelect(null) : undefined}
        onKeyDown={onSelect ? (event) => onKeyDown(event) : undefined}
      >
        <defs>
          <clipPath id={clipId}>
            <rect width={SIZE} height={SIZE} rx={8} />
          </clipPath>
        </defs>
        <g clipPath={zoomed ? `url(#${clipId})` : undefined}>
          <g aria-hidden="true">
            {rings.map((radius) => {
              const r = radius * scale * view.scale;
              return (
                <g key={radius}>
                  <circle cx={origin.cx} cy={origin.cy} r={r} className={styles.ring} />
                  <text
                    x={origin.cx + r * Math.SQRT1_2 + 3}
                    y={origin.cy - r * Math.SQRT1_2 - 3}
                    className={styles.ringLabel}
                  >
                    {`${format(radius)} ${unit}`}
                  </text>
                </g>
              );
            })}
            <line
              x1={zoomed ? 0 : MARGIN / 2}
              x2={zoomed ? SIZE : SIZE - MARGIN / 2}
              y1={origin.cy}
              y2={origin.cy}
              className={styles.axis}
            />
            <line
              x1={origin.cx}
              x2={origin.cx}
              y1={zoomed ? 0 : MARGIN / 2}
              y2={zoomed ? SIZE : SIZE - MARGIN / 2}
              className={styles.axis}
            />
            <polyline
              points={points
                .map(position)
                .map(({ cx: x, cy: y }) => `${x},${y}`)
                .join(' ')}
              className={cx(styles.path, hasSelection && styles.dimmedPath)}
            />
            {points.map((point, index) => {
              if (!point.radius) return null;
              const { cx: x, cy: y } = position(point);
              return (
                <circle
                  key={point.key}
                  cx={x}
                  cy={y}
                  r={point.radius * scale * view.scale}
                  className={cx(
                    styles.circle,
                    hasSelection && (index === selected ? styles.selectedCircle : styles.dimmed),
                  )}
                />
              );
            })}
          </g>
          {order.map((index) => {
            const point = points[index]!;
            const { cx: x, cy: y } = position(point);
            const highlighted = hasSelection ? index === selected : index === last;
            const dot = (
              <>
                <circle cx={x} cy={y} r={highlighted ? 11 : 9} />
                <text x={x} y={y + 4} textAnchor="middle">
                  {point.label}
                </text>
              </>
            );
            const className = cx(
              highlighted ? styles.last : styles.point,
              hasSelection && index !== selected && styles.dimmed,
            );
            if (!onSelect) {
              return (
                <g key={point.key} className={className} aria-hidden="true">
                  {dot}
                </g>
              );
            }
            return (
              <g
                key={point.key}
                className={cx(className, styles.button)}
                role="button"
                tabIndex={0}
                aria-label={`Ronda ${point.label}`}
                aria-pressed={index === selected}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!zoom.wasGesture()) toggle(point.key);
                }}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  onKeyDown(event, point.key);
                }}
              >
                <circle cx={x} cy={y} r={HIT_RADIUS} className={styles.hit} />
                <g aria-hidden="true">{dot}</g>
              </g>
            );
          })}
        </g>
      </svg>
      {onSelect && <ScatterZoomControls view={view} onView={setView} />}
    </div>
  );
}
