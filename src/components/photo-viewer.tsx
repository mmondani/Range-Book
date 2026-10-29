import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useModal } from '@/hooks/use-modal';
import { usePhotoSrc } from '@/hooks/use-photos';
import { cx } from '@/lib/cx';
import type { PhotoDraft } from '@/lib/photos';
import {
  canPan,
  fitContent,
  fullView,
  isZoomed,
  MAX_ZOOM,
  panView,
  pinchView,
  zoomAt,
  type ContentSize,
  type ViewPoint,
  type ZoomView,
} from '@/lib/zoom';
import { IconButton } from './icon-button';
import styles from './photo-viewer.module.css';

export interface PhotoViewerProps {
  photos: readonly PhotoDraft[];
  /** La foto con la que abre. */
  start: number;
  /** Nombre del visor para lectores de pantalla, por ejemplo "Fotos del polígono". */
  label: string;
  onClose: () => void;
}

const ZOOM_STEP = 2;
const DOUBLE_TAP_ZOOM = 2.5;
const WHEEL_ZOOM_SPEED = 0.01;
/** Un toque que se mueve más que esto es un gesto, no un toque. */
const TAP_TOLERANCE_PX = 8;
/** Lo que hay que deslizar en horizontal para pasar de foto. */
const SWIPE_PX = 50;
const DOUBLE_TAP_MS = 300;
const CENTER: ViewPoint = { x: 0.5, y: 0.5 };
/** Hasta conocer la foto, se la toma del tamaño del recuadro. */
const WHOLE_FRAME: ContentSize = { width: 1, height: 1 };

const percent = (fraction: number) => `${Math.round(fraction * 1e6) / 1e4}%`;

/** Punto de la pantalla en fracciones del recuadro; `undefined` si todavía no tiene tamaño. */
function viewPointIn(element: HTMLElement, clientX: number, clientY: number) {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return undefined;
  return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
}

/**
 * Visor de fotos a pantalla completa (M13 / W08), sobre fondo negro. Deslizar, las flechas o el
 * teclado cambian de foto; dos dedos, el doble toque, Ctrl + rueda o los botones acercan; con la
 * foto ampliada, un dedo o el mouse la desplazan. Escape y "Cerrar" lo cierran.
 */
export function PhotoViewer({ photos, start, label, onClose }: PhotoViewerProps) {
  const [current, setCurrent] = useState(() => Math.min(Math.max(start, 0), photos.length - 1));
  const photo = photos[current];
  const src = usePhotoSrc(photo!);
  const [imageRatio, setImageRatio] = useState<number>();
  const [frameRatio, setFrameRatio] = useState(1);
  const content = imageRatio ? fitContent(imageRatio, frameRatio) : WHOLE_FRAME;
  // `null` es la foto entera (así sigue entera cuando se conoce su tamaño o cambia la pantalla).
  const [zoom, setView] = useState<ZoomView | null>(null);
  const view = zoom ?? fullView(content);
  const dialogRef = useModal<HTMLDivElement>(true, onClose);
  const frameRef = useRef<HTMLDivElement>(null);

  // Proporción del recuadro (la pantalla): cambia al girar el teléfono o achicar la ventana.
  useLayoutEffect(() => {
    function measure() {
      const rect = frameRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) setFrameRatio(rect.width / rect.height);
    }
    function handleResize() {
      measure();
      setView(null);
    }
    measure();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /** Cambia de foto; cada una arranca entera. */
  function go(index: number) {
    if (index < 0 || index >= photos.length || index === current) return;
    setCurrent(index);
    setImageRatio(undefined);
    setView(null);
  }

  // Flechas del teclado: anterior y siguiente. Nativo, como Escape en `useModal`.
  const stepRef = useRef((delta: number) => go(current + delta));
  useEffect(() => {
    stepRef.current = (delta) => go(current + delta);
  });
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      stepRef.current(event.key === 'ArrowLeft' ? -1 : 1);
    }
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [dialogRef]);

  // En la primera o la última foto, su flecha se deshabilita: si tenía el foco, el foco vuelve al
  // visor (si no, quedaría afuera y no andarían ni las flechas del teclado ni Escape).
  useEffect(() => {
    const node = dialogRef.current;
    const active = document.activeElement as HTMLButtonElement | null;
    if (node && (!node.contains(active) || active?.disabled)) node.focus();
  }, [dialogRef, current]);

  // La vista actual para el listener de la rueda, que no se vuelve a registrar.
  const viewRef = useRef({ view, content });
  useEffect(() => {
    viewRef.current = { view, content };
  });

  // Rueda: con Ctrl (o el pellizco del trackpad) acerca o aleja; con la foto ampliada, desplaza.
  // Se registra a mano porque React la registra pasiva y no se puede cancelar el scroll.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    function handleWheel(event: WheelEvent) {
      const { view: now, content: size } = viewRef.current;
      const lines = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
      if (event.ctrlKey) {
        event.preventDefault();
        const at = viewPointIn(frame!, event.clientX, event.clientY);
        const factor = Math.exp(-event.deltaY * lines * WHEEL_ZOOM_SPEED);
        if (at) setView(zoomAt(now, factor, at, size));
        return;
      }
      if (!canPan(now, size)) return;
      event.preventDefault();
      const rect = frame!.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      setView(
        panView(
          now,
          (-event.deltaX * lines) / rect.width,
          (-event.deltaY * lines) / rect.height,
          size,
        ),
      );
    }
    frame.addEventListener('wheel', handleWheel, { passive: false });
    return () => frame.removeEventListener('wheel', handleWheel);
  }, []);

  // --- Punteros ------------------------------------------------------------------------------

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    kind: 'one' | 'pinch';
    view: ZoomView;
    points: { x: number; y: number }[];
    moved: boolean;
  }>(undefined);
  const lastTap = useRef<{ time: number; x: number; y: number }>(undefined);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    frameRef.current?.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    gesture.current = {
      kind: points.length >= 2 ? 'pinch' : 'one',
      view,
      points,
      moved: points.length >= 2,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const frame = frameRef.current;
    const started = gesture.current;
    if (!frame) return;

    if (started.kind === 'pinch') {
      const now = [...pointers.current.values()];
      const from = started.points.map((p) => viewPointIn(frame, p.x, p.y));
      const to = now.map((p) => viewPointIn(frame, p.x, p.y));
      if (from[0] && from[1] && to[0] && to[1]) {
        setView(pinchView(started.view, [from[0], from[1]], [to[0], to[1]], content));
      }
      return;
    }

    const origin = started.points[0]!;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.hypot(dx, dy) > TAP_TOLERANCE_PX) started.moved = true;
    // Con la foto ampliada, un dedo la desplaza; si no, el deslizamiento se resuelve al soltar.
    if (started.moved && canPan(started.view, content)) {
      const rect = frame.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setView(panView(started.view, dx / rect.width, dy / rect.height, content));
      }
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.delete(event.pointerId)) return;
    const started = gesture.current;
    if (pointers.current.size > 0) {
      // Queda un dedo de un pellizco: sigue desplazando desde ahí, sin contar como toque.
      const points = [...pointers.current.values()];
      gesture.current = { kind: 'one', view, points, moved: true };
      return;
    }
    gesture.current = undefined;
    if (!started || started.kind === 'pinch') return;

    const origin = started.points[0]!;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (started.moved) {
      // Deslizar en horizontal, sin zoom, cambia de foto.
      if (!isZoomed(started.view) && Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
        go(current + (dx < 0 ? 1 : -1));
      }
      return;
    }

    // Doble toque: acerca donde se tocó o vuelve a la foto entera.
    const now = Date.now();
    const previous = lastTap.current;
    const isDouble =
      previous &&
      now - previous.time < DOUBLE_TAP_MS &&
      Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < TAP_TOLERANCE_PX * 3;
    if (isDouble) {
      lastTap.current = undefined;
      const at = frameRef.current && viewPointIn(frameRef.current, event.clientX, event.clientY);
      setView(isZoomed(view) ? null : zoomAt(view, DOUBLE_TAP_ZOOM, at ?? CENTER, content));
    } else {
      lastTap.current = { time: now, x: event.clientX, y: event.clientY };
    }
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) gesture.current = undefined;
  }

  const imageStyle: CSSProperties = {
    left: percent(view.x),
    top: percent(view.y),
    width: percent(content.width * view.scale),
    height: percent(content.height * view.scale),
  };
  const alt = `Foto ${current + 1} de ${photos.length}`;
  const many = photos.length > 1;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className={styles.viewer}
    >
      <div
        ref={frameRef}
        className={styles.frame}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {src.status === 'ready' && (
          <img
            key={src.src}
            src={src.src}
            alt={alt}
            className={styles.image}
            style={imageStyle}
            draggable={false}
            onLoad={(event) => {
              const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
              if (width > 0 && height > 0) setImageRatio(width / height);
            }}
          />
        )}
        {src.status === 'error' && (
          <span role="img" aria-label={`${alt}: no se pudo cargar`} className={styles.error} />
        )}
      </div>

      <div className={styles.bar}>
        <span className={cx('num', styles.counter)} aria-live="polite">
          {many ? `${current + 1} / ${photos.length}` : ''}
        </span>
        <IconButton aria-label="Cerrar" onPhoto data-autofocus onClick={onClose}>
          <X aria-hidden="true" />
        </IconButton>
      </div>

      {many && (
        <>
          <IconButton
            aria-label="Foto anterior"
            onPhoto
            disabled={current === 0}
            className={cx(styles.nav, styles.previous)}
            onClick={() => go(current - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </IconButton>
          <IconButton
            aria-label="Foto siguiente"
            onPhoto
            disabled={current === photos.length - 1}
            className={cx(styles.nav, styles.next)}
            onClick={() => go(current + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </IconButton>
        </>
      )}

      <div className={styles.zoom}>
        <IconButton
          aria-label="Acercar"
          onPhoto
          disabled={view.scale >= MAX_ZOOM}
          onClick={() => setView(zoomAt(view, ZOOM_STEP, CENTER, content))}
        >
          <ZoomIn aria-hidden="true" />
        </IconButton>
        <IconButton
          aria-label="Alejar"
          onPhoto
          disabled={!isZoomed(view)}
          onClick={() => setView(zoomAt(view, 1 / ZOOM_STEP, CENTER, content))}
        >
          <ZoomOut aria-hidden="true" />
        </IconButton>
      </div>
    </div>,
    document.body,
  );
}
