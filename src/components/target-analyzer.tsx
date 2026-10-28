import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { usePhotoSrc } from '@/hooks/use-photos';
import type { ImageSize, Pixel } from '@/lib/calibration';
import { cx } from '@/lib/cx';
import type { PhotoDraft } from '@/lib/photos';
import styles from './target-analyzer.module.css';

/**
 * Con el dedo, el arrastre empieza después de esta espera: si en ese tiempo se apoya un segundo
 * dedo, el gesto es un zoom y el marcador no se mueve.
 */
export const TOUCH_DRAG_DELAY_MS = 100;

/** Gesto en curso sobre la foto. */
type Gesture = 'idle' | 'pending' | 'dragging' | 'zoom';

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
  /**
   * Si está, el punto se puede arrastrar: mientras se mantiene apretado sigue al dedo o al mouse
   * (`onPointMove`) y al soltar se fija (`onPoint`).
   */
  onPointMove?: (pixel: Pixel) => void;
  /** El arrastre se interrumpió (un segundo dedo, el zoom del navegador): el punto vuelve atrás. */
  onPointCancel?: () => void;
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
  onPointMove,
  onPointCancel,
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

  // Punteros apoyados sobre la foto, gesto en curso, último punto y espera antes de arrastrar.
  const pointers = useRef(new Set<number>());
  const gesture = useRef<Gesture>('idle');
  const last = useRef<Pixel>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // El `click` que sigue a un arrastre o a un zoom se ignora (ya se resolvió con los punteros).
  const ignoreClick = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  /** Punto de la foto bajo el puntero, dentro de sus bordes (al arrastrar se puede salir). */
  function pixelAt(event: MouseEvent<HTMLButtonElement>): Pixel | undefined {
    if (!size) return undefined;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return undefined;
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    return {
      x: clamp((event.clientX - rect.left) / rect.width) * size.width,
      y: clamp((event.clientY - rect.top) / rect.height) * size.height,
    };
  }

  function handlePoint(event: MouseEvent<HTMLButtonElement>) {
    if (ignoreClick.current) {
      ignoreClick.current = false;
      return;
    }
    // Con el teclado no hay un punto que ubicar (`detail` es 0).
    if (event.detail === 0) return;
    const pixel = pixelAt(event);
    if (pixel) onPoint(pixel);
  }

  /** Corta el arrastre: si el marcador ya se había movido, vuelve atrás. */
  function interrupt() {
    clearTimeout(timer.current);
    if (gesture.current === 'dragging') onPointCancel?.();
    ignoreClick.current = true;
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!onPointMove) return;
    // El primer dedo de un gesto nuevo: si se perdió algún `pointerup`, no queda colgado.
    if (event.isPrimary) pointers.current.clear();
    pointers.current.add(event.pointerId);
    // Un segundo dedo: es un zoom, no un arrastre.
    if (pointers.current.size > 1) {
      interrupt();
      gesture.current = 'zoom';
      return;
    }
    ignoreClick.current = false;
    const pixel = pixelAt(event);
    if (!pixel || event.button !== 0) return;
    // Los movimientos siguen llegando aunque el dedo salga de la foto (jsdom no lo implementa).
    event.currentTarget.setPointerCapture?.(event.pointerId);
    last.current = pixel;
    if (event.pointerType !== 'touch') {
      gesture.current = 'dragging';
      onPointMove(pixel);
      return;
    }
    gesture.current = 'pending';
    timer.current = setTimeout(() => {
      if (gesture.current !== 'pending' || !last.current) return;
      gesture.current = 'dragging';
      onPointMove(last.current);
    }, TOUCH_DRAG_DELAY_MS);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (gesture.current !== 'pending' && gesture.current !== 'dragging') return;
    const pixel = pixelAt(event);
    if (!pixel) return;
    last.current = pixel;
    if (gesture.current === 'dragging') onPointMove?.(pixel);
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    pointers.current.delete(event.pointerId);
    const current = gesture.current;
    if (current === 'zoom') {
      // El zoom termina cuando se levantan todos los dedos; ninguno ubica el punto.
      if (pointers.current.size === 0) gesture.current = 'idle';
      return;
    }
    if (current !== 'pending' && current !== 'dragging') return;
    clearTimeout(timer.current);
    gesture.current = 'idle';
    // Un toque corto (antes de que empiece el arrastre) también ubica el punto.
    const pixel = pixelAt(event) ?? last.current;
    if (!pixel) return;
    ignoreClick.current = true;
    onPoint(pixel);
  }

  function handlePointerCancel(event: PointerEvent<HTMLButtonElement>) {
    pointers.current.delete(event.pointerId);
    // El navegador tomó el gesto (zoom, desplazamiento).
    if (gesture.current === 'pending' || gesture.current === 'dragging') interrupt();
    gesture.current = pointers.current.size > 0 ? 'zoom' : 'idle';
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
            className={cx(styles.surface, onPointMove && styles.draggable)}
            aria-label={pointLabel ?? 'Foto del blanco'}
            disabled={!pointLabel}
            onClick={handlePoint}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
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
