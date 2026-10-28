import type { ChartLayout, ChartPoint } from '@/lib/chart';
import { formatDayMonth } from '@/lib/format';
import styles from './chart.module.css';

export interface ChartHitAreasProps {
  layout: ChartLayout;
  points: readonly ChartPoint[];
  onActive: (index: number) => void;
}

/** Franjas invisibles: al pasar el mouse o tocar una, se destaca su punto con el valor. */
export function ChartHitAreas({ layout, points, onActive }: ChartHitAreasProps) {
  return (
    <g>
      {points.map((point, index) => (
        <rect
          key={point.key}
          x={layout.left + layout.band * index}
          y={0}
          width={layout.band}
          height={layout.height}
          className={styles.hit}
          onPointerEnter={() => onActive(index)}
          onClick={() => onActive(index)}
        >
          <title>{`${formatDayMonth(point.date)}: ${point.label}`}</title>
        </rect>
      ))}
    </g>
  );
}
