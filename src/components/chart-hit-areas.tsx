import type { ChartLayout, ChartPoint } from '@/lib/chart';
import styles from './chart.module.css';

export interface ChartHitAreasProps {
  layout: ChartLayout;
  points: readonly ChartPoint[];
  onActive: (index: number) => void;
  /** El punto seleccionado (con `onSelect`). */
  selectedIndex?: number | null;
  /** Con esto, cada franja es un botón que selecciona su punto (o lo quita, con `null`). */
  onSelect?: (index: number | null) => void;
}

/**
 * Franjas invisibles: al pasar el mouse o tocar una, se destaca su punto con su fecha o ronda.
 * Con `onSelect`, tocarla además selecciona el punto, y tocarlo de nuevo lo quita.
 */
export function ChartHitAreas({
  layout,
  points,
  onActive,
  selectedIndex = null,
  onSelect,
}: ChartHitAreasProps) {
  return (
    <g>
      {points.map((point, index) => {
        const area = {
          x: layout.band * index,
          y: 0,
          width: layout.band,
          height: layout.height,
          className: styles.hit,
        };
        if (!onSelect) {
          return (
            <rect
              key={point.key}
              {...area}
              onPointerEnter={() => onActive(index)}
              onClick={() => onActive(index)}
            >
              <title>{`${point.axisLabel}: ${point.label}`}</title>
            </rect>
          );
        }
        const toggle = () => onSelect(index === selectedIndex ? null : index);
        return (
          <rect
            key={point.key}
            {...area}
            role="button"
            tabIndex={0}
            aria-label={point.name ?? point.axisLabel}
            aria-pressed={index === selectedIndex}
            // El hover destaca sin seleccionar; en una pantalla táctil, el toque selecciona.
            onPointerEnter={(event) => event.pointerType === 'mouse' && onActive(index)}
            onClick={toggle}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggle();
              } else if (event.key === 'Escape') {
                onSelect(null);
              }
            }}
          >
            <title>{`${point.axisLabel}: ${point.label}`}</title>
          </rect>
        );
      })}
    </g>
  );
}
