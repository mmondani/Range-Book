import { LoaderCircle } from 'lucide-react';
import type { CSSProperties, MouseEvent } from 'react';
import { usePhotoSrc } from '@/hooks/use-photos';
import type { ImageSize, Pixel } from '@/lib/calibration';
import { cx } from '@/lib/cx';
import type { PhotoDraft } from '@/lib/photos';
import styles from './target-analyzer.module.css';

/** Marcador de la calibración sobre la foto. */
export interface AnalyzerMarker {
  key: string;
  at: Pixel;
  /** El centro es una cruz; el resto, un círculo con un texto corto opcional (`A`, `B`). */
  cross?: boolean;
  text?: string;
  /** El que se ubica con el próximo toque. */
  active?: boolean;
}

export interface TargetAnalyzerProps {
  photo: PhotoDraft;
  alt: string;
  /** Tamaño de la foto: el de la calibración guardada o el que se lee al cargarla. */
  size: ImageSize | undefined;
  onSize: (size: ImageSize) => void;
  /** Qué hace tocar la foto (nombre accesible). Sin él, tocar la foto no hace nada. */
  pointLabel?: string;
  onPoint: (pixel: Pixel) => void;
  markers?: readonly AnalyzerMarker[];
  /** Anillos calibrados, para comparar con los de la foto. */
  rings?: readonly { key: string; center: Pixel; radius: number }[];
  /** Línea entre los dos puntos de referencia (blancos sin zonas). */
  line?: readonly [Pixel, Pixel];
  impacts?: readonly Pixel[];
  impactLabel?: (index: number) => string;
  /** Modo Quitar: los impactos son botones. */
  onRemoveImpact?: (index: number) => void;
  /** PMI: cruz azul. */
  mpi?: Pixel | null;
  /** Círculo de grupo, punteado, alrededor del PMI. */
  group?: { center: Pixel; radius: number } | null;
  /** Texto del overlay de progreso (por ejemplo, "Detectando impactos…"). */
  busy?: string;
  className?: string;
}

/**
 * Foto del blanco con sus superposiciones: marcadores y anillos de la calibración, impactos, PMI
 * y grupo. Las coordenadas son píxeles de la foto; los colores no cambian con el tema.
 */
export function TargetAnalyzer({
  photo,
  alt,
  size,
  onSize,
  pointLabel,
  onPoint,
  markers = [],
  rings = [],
  line,
  impacts = [],
  impactLabel = (index) => `Impacto ${index + 1}`,
  onRemoveImpact,
  mpi,
  group,
  busy,
  className,
}: TargetAnalyzerProps) {
  const src = usePhotoSrc(photo);

  const position = (pixel: Pixel): CSSProperties =>
    size
      ? { left: `${(pixel.x / size.width) * 100}%`, top: `${(pixel.y / size.height) * 100}%` }
      : {};

  function handlePoint(event: MouseEvent<HTMLButtonElement>) {
    // Con el teclado no hay un punto que ubicar (`detail` es 0).
    if (!size || event.detail === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    onPoint({
      x: ((event.clientX - rect.left) / rect.width) * size.width,
      y: ((event.clientY - rect.top) / rect.height) * size.height,
    });
  }

  return (
    <div
      className={cx(styles.frame, className)}
      style={size ? { aspectRatio: `${size.width} / ${size.height}` } : undefined}
      aria-busy={src.status === 'loading' || Boolean(busy) || undefined}
    >
      {src.status === 'ready' && (
        <img
          src={src.src}
          alt={alt}
          className={styles.image}
          onLoad={(event) => {
            const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
            if (width > 0 && height > 0) onSize({ width, height });
          }}
        />
      )}
      {src.status === 'error' && (
        <span role="img" aria-label={`${alt}: no se pudo cargar`} className={styles.error} />
      )}

      {size && (
        <>
          <svg
            viewBox={`0 0 ${size.width} ${size.height}`}
            className={styles.layer}
            aria-hidden="true"
          >
            {rings.map((ring) => (
              <circle
                key={ring.key}
                cx={ring.center.x}
                cy={ring.center.y}
                r={ring.radius}
                className={styles.ring}
              />
            ))}
            {line && (
              <line
                x1={line[0].x}
                y1={line[0].y}
                x2={line[1].x}
                y2={line[1].y}
                className={styles.ring}
              />
            )}
            {group && (
              <circle
                cx={group.center.x}
                cy={group.center.y}
                r={group.radius}
                className={styles.group}
              />
            )}
          </svg>

          <button
            type="button"
            className={styles.surface}
            aria-label={pointLabel ?? 'Foto del blanco'}
            disabled={!pointLabel}
            onClick={handlePoint}
          />

          {markers.map((marker) => (
            <span
              key={marker.key}
              aria-hidden="true"
              className={cx(
                styles.marker,
                marker.active && styles.active,
                marker.cross && styles.cross,
              )}
              style={position(marker.at)}
            >
              {marker.text}
            </span>
          ))}

          {impacts.map((impact, index) =>
            onRemoveImpact ? (
              <button
                key={index}
                type="button"
                className={cx(styles.impact, styles.removable)}
                style={position(impact)}
                aria-label={`Quitar ${impactLabel(index).toLocaleLowerCase('es-AR')}`}
                onClick={() => onRemoveImpact(index)}
              />
            ) : (
              <span
                key={index}
                aria-hidden="true"
                className={styles.impact}
                style={position(impact)}
              />
            ),
          )}

          {mpi && <span aria-hidden="true" className={styles.mpi} style={position(mpi)} />}
        </>
      )}

      {busy && (
        <div role="status" className={styles.busy}>
          <LoaderCircle aria-hidden="true" className={styles.spinner} />
          {busy}
        </div>
      )}
    </div>
  );
}
