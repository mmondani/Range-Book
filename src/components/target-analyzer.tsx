import { LoaderCircle, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useIsDesktop } from '@/hooks/use-media-query';
import { usePhotoSrc } from '@/hooks/use-photos';
import type { ImageSize, Pixel, PixelEllipse } from '@/lib/calibration';
import { cx } from '@/lib/cx';
import type { PhotoDraft } from '@/lib/photos';
import {
  canPan,
  clampView,
  fitContent,
  fullView,
  initialView,
  isZoomed,
  MAX_ZOOM,
  panView,
  pinchView,
  zoomAt,
  type ContentSize,
  type ViewPoint,
  type ZoomView,
} from '@/lib/zoom';
import { SvgEllipse } from './svg-ellipse';
import styles from './target-analyzer.module.css';

/**
 * Con el dedo, el arrastre empieza después de esta espera: si en ese tiempo se apoya un segundo
 * dedo, el gesto es un zoom y el marcador no se mueve.
 */
export const TOUCH_DRAG_DELAY_MS = 100;

/** Cuánto hay que mover el dedo o el mouse para desplazar la foto en vez de tocarla. */
const PAN_THRESHOLD_PX = 8;
/** Factor de los botones de zoom. */
const ZOOM_STEP = 2;
/** Sensibilidad del zoom con Ctrl + rueda (o pellizco en el trackpad). */
const WHEEL_ZOOM_SPEED = 0.01;
const CENTER: ViewPoint = { x: 0.5, y: 0.5 };
const NO_CONTENT: ContentSize = { width: 1, height: 1 };

/** Proporción del recuadro (ancho / alto): apenas más alto que ancho en el celular, cuadrado en desktop. */
export const FRAME_RATIO = { mobile: 5 / 6, desktop: 1 };

/**
 * Gesto en curso sobre la foto: arrastre de un marcador (`pending` mientras espera un posible
 * segundo dedo), toque que puede pasar a desplazamiento (`press` → `pan`), pellizco y el final de
 * un pellizco (`done`: se ignoran los dedos que quedan hasta levantarlos todos).
 */
type Gesture = 'idle' | 'pending' | 'dragging' | 'press' | 'pan' | 'pinch' | 'done';

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
  /** El arrastre se interrumpió (un segundo dedo, el navegador tomó el gesto): vuelve atrás. */
  onPointCancel?: () => void;
  markers?: readonly AnalyzerMarker[];
  /** Anillos calibrados (elipses si la foto está en ángulo), para comparar con los de la foto. */
  rings?: readonly (PixelEllipse & { key: string })[];
  /** Línea entre los dos puntos de referencia (blancos sin zonas). */
  line?: readonly [Pixel, Pixel];
  impacts?: readonly Pixel[];
  impactLabel?: (index: number) => string;
  /** Modo Quitar: los impactos son botones. */
  onRemoveImpact?: (index: number) => void;
  /** PMI: cruz azul. */
  mpi?: Pixel | null;
  /** Círculo de grupo, punteado, alrededor del PMI (elipse si la foto está en ángulo). */
  group?: PixelEllipse | null;
  /** Controles propios sobre la foto, arriba a la izquierda (por ejemplo, el punto a ubicar). */
  controls?: ReactNode;
  /** Texto del overlay de progreso (por ejemplo, "Detectando impactos…"). */
  busy?: string;
  className?: string;
}

const round = (value: number) => Math.round(value * 1e4) / 1e4;
const percent = (fraction: number) => `${round(fraction * 100)}%`;

/** Punto de la pantalla en fracciones del recuadro; `undefined` si todavía no tiene tamaño. */
function viewPointIn(element: HTMLElement, clientX: number, clientY: number) {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return undefined;
  return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
}

/**
 * Foto del blanco con sus superposiciones: marcadores y anillos de la calibración, impactos, PMI
 * y grupo. Las coordenadas son píxeles de la foto; los colores no cambian con el tema.
 *
 * El recuadro tiene proporción fija y la foto arranca cubriéndolo, centrada; "Ver la foto entera"
 * la muestra completa. El zoom es propio, dentro del recuadro (la página no se mueve): dos dedos
 * acercan, alejan y desplazan; si la foto es más grande que el recuadro, un dedo o el mouse la
 * desplazan (salvo al arrastrar un marcador); Ctrl + rueda acerca donde está el cursor y la rueda
 * desplaza. Los marcadores y los trazos mantienen su tamaño en pantalla.
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
  controls,
  busy,
  className,
}: TargetAnalyzerProps) {
  const src = usePhotoSrc(photo);
  const frameRatio = useIsDesktop() ? FRAME_RATIO.desktop : FRAME_RATIO.mobile;
  // La foto entera dentro del recuadro; hasta conocer su tamaño, ocupa todo el recuadro.
  const content = size ? fitContent(size.width / size.height, frameRatio) : NO_CONTENT;
  // Sin gestos todavía, la vista inicial: la foto cubre el recuadro, centrada. Se ajusta en cada
  // render por si cambia el recuadro (por ejemplo, al pasar de celular a desktop).
  const [userView, setView] = useState<ZoomView | null>(null);
  const view = clampView(userView ?? initialView(content), content);
  const zoomed = isZoomed(view);
  const pannable = canPan(view, content);

  const frameRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLButtonElement>(null);
  // Los botones sobre la foto (zoom y los propios) no inician gestos.
  const zoomControlsRef = useRef<HTMLDivElement>(null);
  const extraControlsRef = useRef<HTMLDivElement>(null);
  // La vista actual para el listener de la rueda, que no se vuelve a registrar.
  const viewRef = useRef({ view, content });
  useEffect(() => {
    viewRef.current = { view, content };
  });

  // Punteros apoyados (en coordenadas de pantalla), gesto en curso y cómo empezó.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture>('idle');
  const start = useRef<{ view: ZoomView; points: { x: number; y: number }[] }>({
    view: fullView(NO_CONTENT),
    points: [],
  });
  // Último punto del marcador que se arrastra y espera antes de empezar a arrastrarlo.
  const last = useRef<Pixel>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // El `click` que sigue a un arrastre, un desplazamiento o un pellizco se ignora.
  const ignoreClick = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Rueda: con Ctrl (o el pellizco del trackpad) acerca o aleja; con la foto ampliada, desplaza.
  // Se registra a mano porque React la registra pasiva y no se puede cancelar el scroll.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    function handleWheel(event: WheelEvent) {
      const { view: current, content: size } = viewRef.current;
      const lines = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
      if (event.ctrlKey) {
        event.preventDefault();
        const at = viewPointIn(frame!, event.clientX, event.clientY);
        const factor = Math.exp(-event.deltaY * lines * WHEEL_ZOOM_SPEED);
        if (at) setView(zoomAt(current, factor, at, size));
        return;
      }
      if (!canPan(current, size)) return;
      event.preventDefault();
      const rect = frame!.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      setView(
        panView(
          current,
          (-event.deltaX * lines) / rect.width,
          (-event.deltaY * lines) / rect.height,
          size,
        ),
      );
    }
    frame.addEventListener('wheel', handleWheel, { passive: false });
    return () => frame.removeEventListener('wheel', handleWheel);
  }, []);

  const position = (pixel: Pixel): CSSProperties =>
    size
      ? { left: `${(pixel.x / size.width) * 100}%`, top: `${(pixel.y / size.height) * 100}%` }
      : {};

  /** Punto de la foto bajo el puntero, dentro de sus bordes (al arrastrar se puede salir). */
  function pixelAt(clientX: number, clientY: number): Pixel | undefined {
    const surface = surfaceRef.current;
    if (!size || !surface) return undefined;
    // El rectángulo de la superficie ya incluye el zoom.
    const rect = surface.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return undefined;
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    return {
      x: clamp((clientX - rect.left) / rect.width) * size.width,
      y: clamp((clientY - rect.top) / rect.height) * size.height,
    };
  }

  /** `true` si el click viene de un gesto que ya se resolvió con los punteros. */
  function consumeIgnoredClick() {
    if (!ignoreClick.current) return false;
    ignoreClick.current = false;
    return true;
  }

  function handlePoint(event: MouseEvent<HTMLButtonElement>) {
    if (consumeIgnoredClick()) return;
    // Con el teclado no hay un punto que ubicar (`detail` es 0).
    if (event.detail === 0) return;
    const pixel = pixelAt(event.clientX, event.clientY);
    if (pixel) onPoint(pixel);
  }

  /** Corta el arrastre del marcador: si ya se había movido, vuelve atrás. */
  function interrupt() {
    clearTimeout(timer.current);
    if (gesture.current === 'dragging') onPointCancel?.();
    ignoreClick.current = true;
  }

  function capture(event: PointerEvent<HTMLDivElement>) {
    // Los movimientos siguen llegando aunque el puntero salga de la foto (jsdom no lo implementa).
    frameRef.current?.setPointerCapture?.(event.pointerId);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const target = event.target as Node;
    if (zoomControlsRef.current?.contains(target) || extraControlsRef.current?.contains(target)) {
      return;
    }
    // El primer dedo de un gesto nuevo: si se perdió algún `pointerup`, no queda colgado.
    if (event.isPrimary) pointers.current.clear();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    // Un segundo dedo: pellizco (zoom y desplazamiento), nunca un arrastre.
    if (pointers.current.size === 2) {
      interrupt();
      gesture.current = 'pinch';
      start.current = { view, points: [...pointers.current.values()] };
      return;
    }
    if (pointers.current.size > 2) return;

    ignoreClick.current = false;
    gesture.current = 'idle';
    if (event.button !== 0) return;
    start.current = { view, points: [{ x: event.clientX, y: event.clientY }] };

    // Sobre la foto, con un marcador para ubicar: arrastre.
    if (onPointMove && event.target === surfaceRef.current) {
      const pixel = pixelAt(event.clientX, event.clientY);
      if (!pixel) return;
      capture(event);
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
      return;
    }
    // Si no, un toque que puede pasar a desplazar la foto ampliada.
    gesture.current = 'press';
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const frame = frameRef.current;

    switch (gesture.current) {
      case 'pinch': {
        const [a, b] = [...pointers.current.values()];
        const [a0, b0] = start.current.points;
        if (!frame || !a || !b || !a0 || !b0) return;
        const from = [viewPointIn(frame, a0.x, a0.y), viewPointIn(frame, b0.x, b0.y)];
        const to = [viewPointIn(frame, a.x, a.y), viewPointIn(frame, b.x, b.y)];
        if (!from[0] || !from[1] || !to[0] || !to[1]) return;
        setView(pinchView(start.current.view, [from[0], from[1]], [to[0], to[1]], content));
        return;
      }
      case 'pending':
      case 'dragging': {
        const pixel = pixelAt(event.clientX, event.clientY);
        if (!pixel) return;
        last.current = pixel;
        if (gesture.current === 'dragging') onPointMove?.(pixel);
        return;
      }
      case 'press': {
        const origin = start.current.points[0];
        if (!origin || !canPan(start.current.view, content)) return;
        const moved = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
        if (moved < PAN_THRESHOLD_PX) return;
        gesture.current = 'pan';
        ignoreClick.current = true;
        capture(event);
        break;
      }
      case 'pan':
        break;
      default:
        return;
    }

    // Desplazamiento con un dedo o el mouse.
    const origin = start.current.points[0];
    const rect = frame?.getBoundingClientRect();
    if (!origin || !rect || rect.width === 0 || rect.height === 0) return;
    setView(
      panView(
        start.current.view,
        (event.clientX - origin.x) / rect.width,
        (event.clientY - origin.y) / rect.height,
        content,
      ),
    );
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.delete(event.pointerId)) return;
    const current = gesture.current;
    if (current === 'pinch' || current === 'done') {
      // El pellizco termina cuando se levantan todos los dedos; ninguno ubica un punto.
      gesture.current = pointers.current.size === 0 ? 'idle' : 'done';
      return;
    }
    gesture.current = 'idle';
    if (current !== 'pending' && current !== 'dragging') return;
    clearTimeout(timer.current);
    // Un toque corto (antes de que empiece el arrastre) también ubica el punto.
    const pixel = pixelAt(event.clientX, event.clientY) ?? last.current;
    if (!pixel) return;
    ignoreClick.current = true;
    onPoint(pixel);
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (gesture.current === 'pending' || gesture.current === 'dragging') interrupt();
    gesture.current = pointers.current.size > 0 ? 'done' : 'idle';
  }

  // El desplazamiento de `translate` es relativo al tamaño de la foto, no al del recuadro.
  const contentStyle = (
    size
      ? {
          width: percent(content.width),
          height: percent(content.height),
          transform: `translate(${percent(view.x / content.width)}, ${percent(
            view.y / content.height,
          )}) scale(${round(view.scale)})`,
          '--zoom': view.scale,
        }
      : {}
  ) as CSSProperties;

  return (
    <div
      ref={frameRef}
      role="group"
      aria-label="Visor de la foto"
      className={cx(styles.frame, (onPointMove || pannable) && styles.locked, className)}
      style={{ aspectRatio: String(frameRatio) }}
      aria-busy={src.status === 'loading' || Boolean(busy) || undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div className={styles.content} style={contentStyle}>
        {src.status === 'ready' && (
          <img
            src={src.src}
            alt={alt}
            className={styles.image}
            draggable={false}
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
                <SvgEllipse key={ring.key} ellipse={ring} className={styles.ring} />
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
              {group && <SvgEllipse ellipse={group} className={styles.group} />}
            </svg>

            <button
              ref={surfaceRef}
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
                  onClick={() => {
                    if (!consumeIgnoredClick()) onRemoveImpact(index);
                  }}
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
      </div>

      {size && (
        <div ref={zoomControlsRef} className={styles.zoomControls}>
          <button
            type="button"
            className={styles.zoomButton}
            aria-label="Acercar"
            disabled={view.scale >= MAX_ZOOM}
            onClick={() => setView(zoomAt(view, ZOOM_STEP, CENTER, content))}
          >
            <ZoomIn aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.zoomButton}
            aria-label="Alejar"
            disabled={!zoomed}
            onClick={() => setView(zoomAt(view, 1 / ZOOM_STEP, CENTER, content))}
          >
            <ZoomOut aria-hidden="true" />
          </button>
          {zoomed && (
            <button
              type="button"
              className={styles.zoomButton}
              aria-label="Ver la foto entera"
              onClick={() => setView(fullView(content))}
            >
              <Maximize2 aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {size && controls && (
        <div ref={extraControlsRef} className={styles.controls}>
          {controls}
        </div>
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
