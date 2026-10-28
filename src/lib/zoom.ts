/**
 * Zoom de la foto dentro de su recuadro. Las posiciones son fracciones del recuadro (0–1). La
 * foto sin zoom (`scale` 1) se ve entera dentro del recuadro y mide `content` (uno de sus lados es
 * 1); un punto `c` de la foto (en fracciones de ese tamaño) se ve en `offset + c × size × scale`.
 */

/** Punto dentro del recuadro, en fracciones de su ancho y alto. */
export interface ViewPoint {
  x: number;
  y: number;
}

/** Escala y desplazamiento de la foto dentro del recuadro. */
export interface ZoomView {
  scale: number;
  x: number;
  y: number;
}

/** Tamaño de la foto entera dentro del recuadro, en fracciones del recuadro. */
export interface ContentSize {
  width: number;
  height: number;
}

/** Hasta cuánto se acerca, respecto de la foto entera. */
export const MAX_ZOOM = 10;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Tamaño de la foto entera (sin recortar) en un recuadro: proporciones como ancho / alto. */
export function fitContent(imageRatio: number, frameRatio: number): ContentSize {
  return imageRatio > frameRatio
    ? { width: 1, height: frameRatio / imageRatio }
    : { width: imageRatio / frameRatio, height: 1 };
}

/** Escala con la que la foto cubre todo el recuadro. */
export function coverScale(content: ContentSize): number {
  return Math.max(1 / content.width, 1 / content.height);
}

/**
 * Escala entre la foto entera y el máximo. En cada eje, si la foto es más chica que el recuadro
 * queda centrada; si es más grande, no deja bordes vacíos.
 */
export function clampView({ scale, x, y }: ZoomView, content: ContentSize): ZoomView {
  const s = clamp(scale, 1, MAX_ZOOM);
  const axis = (offset: number, size: number) => {
    const span = size * s;
    return span <= 1 ? (1 - span) / 2 : clamp(offset, 1 - span, 0);
  };
  return { scale: s, x: axis(x, content.width), y: axis(y, content.height) };
}

/** La foto entera, centrada. */
export function fullView(content: ContentSize): ZoomView {
  return clampView({ scale: 1, x: 0, y: 0 }, content);
}

/** Vista inicial: la foto cubre el recuadro, centrada en el centro de la foto. */
export function initialView(content: ContentSize): ZoomView {
  const scale = coverScale(content);
  return clampView(
    { scale, x: (1 - content.width * scale) / 2, y: (1 - content.height * scale) / 2 },
    content,
  );
}

/** Más acercada que la foto entera. */
export const isZoomed = (view: ZoomView) => view.scale > 1.001;

/** La foto es más grande que el recuadro en algún eje: se puede desplazar. */
export function canPan(view: ZoomView, content: ContentSize): boolean {
  return content.width * view.scale > 1.001 || content.height * view.scale > 1.001;
}

/** Multiplica la escala por `factor` dejando quieto el punto `at` del recuadro. */
export function zoomAt(
  view: ZoomView,
  factor: number,
  at: ViewPoint,
  content: ContentSize,
): ZoomView {
  const scale = clamp(view.scale * factor, 1, MAX_ZOOM);
  const k = scale / view.scale;
  return clampView(
    { scale, x: at.x - (at.x - view.x) * k, y: at.y - (at.y - view.y) * k },
    content,
  );
}

/** Desplaza la foto (en fracciones del recuadro). */
export function panView(view: ZoomView, dx: number, dy: number, content: ContentSize): ZoomView {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy }, content);
}

/**
 * Pellizco: la escala cambia con la distancia entre los dos dedos y el punto de la foto que
 * estaba entre ellos los sigue (zoom y desplazamiento a la vez).
 */
export function pinchView(
  start: ZoomView,
  from: readonly [ViewPoint, ViewPoint],
  to: readonly [ViewPoint, ViewPoint],
  content: ContentSize,
): ZoomView {
  const distance = (points: readonly [ViewPoint, ViewPoint]) =>
    Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  const middle = (points: readonly [ViewPoint, ViewPoint]) => ({
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2,
  });
  const before = distance(from);
  const scale = clamp(start.scale * (before > 0 ? distance(to) / before : 1), 1, MAX_ZOOM);
  const m0 = middle(from);
  const m1 = middle(to);
  // Desplazamiento (sin escala) del punto de la foto que estaba entre los dedos.
  const cx = (m0.x - start.x) / start.scale;
  const cy = (m0.y - start.y) / start.scale;
  return clampView({ scale, x: m1.x - cx * scale, y: m1.y - cy * scale }, content);
}
