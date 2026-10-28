import { cx } from '@/lib/cx';
import type { PhotoDraft } from '@/lib/photos';
import type { TargetZone } from '@/lib/target-zones';
import type { TargetScoring } from '@/lib/targets';
import { Photo } from './photo';
import styles from './target-thumb.module.css';

export interface TargetThumbProps {
  scoring: TargetScoring;
  /** Válidas, en cualquier orden. */
  zones: readonly TargetZone[];
  /** Si tiene, se muestra la foto en lugar del dibujo. */
  photo?: PhotoDraft;
  /** Texto alternativo de la foto; el dibujo es decorativo. */
  alt?: string;
  className?: string;
}

/** Proporción de los anillos (de afuera hacia adentro) que van sobre el centro negro. */
const BLACK_FROM = 0.6;

/**
 * Blanco dibujado a partir de sus zonas (o la silueta de cartón si no tiene), o su foto. Los
 * colores imitan el papel y no cambian con el tema.
 */
export function TargetThumb({ scoring, zones, photo, alt = '', className }: TargetThumbProps) {
  if (photo) {
    return (
      <span className={cx(styles.thumb, className)}>
        <Photo photo={photo} alt={alt} className={styles.photo} />
      </span>
    );
  }

  if (scoring === 'none') {
    return (
      <span className={cx(styles.thumb, styles.cardboard, className)} aria-hidden="true">
        <span className={styles.silhouette} />
      </span>
    );
  }

  const rings = [...zones].sort((a, b) => b.diameterMm - a.diameterMm);
  const largest = rings[0]?.diameterMm ?? 1;
  const blackIndex = Math.ceil(rings.length * BLACK_FROM);
  return (
    <span className={cx(styles.thumb, styles.paper, className)} aria-hidden="true">
      <svg viewBox="0 0 100 100" className={styles.drawing}>
        {rings.map((zone, index) => (
          <circle
            key={`${zone.score}-${zone.diameterMm}`}
            cx="50"
            cy="50"
            r={(zone.diameterMm / largest) * 47}
            className={cx(
              styles.ring,
              index >= blackIndex && styles.inner,
              index === blackIndex && styles.black,
            )}
          />
        ))}
      </svg>
    </span>
  );
}
