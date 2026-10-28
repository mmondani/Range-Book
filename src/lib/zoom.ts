/**
 * Zoom de la foto dentro de su recuadro. Las posiciones son fracciones del recuadro (0–1): un
 * punto `c` de la foto (sin zoom) se ve en `offset + c × scale`.
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

export const MAX_ZOOM = 8;
export const FULL_VIEW: ZoomView = { scale: 1, x: 0, y: 0 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const isZoomed = (view: ZoomView) => view.scale > 1.001;

/** Escala entre 1 y el máximo, y la foto siempre cubriendo el recuadro (sin bordes vacíos). */
export function clampView({ scale, x, y }: ZoomView): ZoomView {
  const s = clamp(scale, 1, MAX_ZOOM);
  return { scale: s, x: clamp(x, 1 - s, 0), y: clamp(y, 1 - s, 0) };
}

/** Multiplica la escala por `factor` dejando quieto el punto `at` del recuadro. */
export function zoomAt(view: ZoomView, factor: number, at: ViewPoint): ZoomView {
  const scale = clamp(view.scale * factor, 1, MAX_ZOOM);
  const k = scale / view.scale;
  return clampView({ scale, x: at.x - (at.x - view.x) * k, y: at.y - (at.y - view.y) * k });
}

/** Desplaza la foto (en fracciones del recuadro). */
export function panView(view: ZoomView, dx: number, dy: number): ZoomView {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy });
}

/**
 * Pellizco: la escala cambia con la distancia entre los dos dedos y el punto de la foto que
 * estaba entre ellos los sigue (zoom y desplazamiento a la vez).
 */
export function pinchView(
  start: ZoomView,
  from: readonly [ViewPoint, ViewPoint],
  to: readonly [ViewPoint, ViewPoint],
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
  // Punto de la foto (sin zoom) que estaba entre los dedos.
  const cx = (m0.x - start.x) / start.scale;
  const cy = (m0.y - start.y) / start.scale;
  return clampView({ scale, x: m1.x - cx * scale, y: m1.y - cy * scale });
}
