import { scatterRings } from './chart';
import { isZoomed, MAX_ZOOM, zoomAt, type ContentSize, type ZoomView } from './zoom';

/**
 * Zoom de la dispersión del PMI (`MpiScatter`). Usa la misma vista que el zoom de la foto
 * (`zoom.ts`): el gráfico es cuadrado y, sin zoom, ocupa todo su recuadro.
 */

/** El gráfico entero en su recuadro. */
export const SCATTER_CONTENT: ContentSize = { width: 1, height: 1 };

/** Sin zoom. */
export const SCATTER_FULL_VIEW: ZoomView = { scale: 1, x: 0, y: 0 };

/** Cuánto acerca o aleja cada toque de los botones − / +. */
export const ZOOM_STEP = 1.6;

/** Un paso de los botones, alrededor del centro del recuadro. */
export function stepZoom(view: ZoomView, direction: 1 | -1): ZoomView {
  const factor = direction === 1 ? ZOOM_STEP : 1 / ZOOM_STEP;
  return zoomAt(view, factor, { x: 0.5, y: 0.5 }, SCATTER_CONTENT);
}

/** Si los botones pueden alejar (o volver a 1×) y acercar. */
export function zoomLimits(view: ZoomView): { canZoomOut: boolean; canZoomIn: boolean } {
  return { canZoomOut: isZoomed(view), canZoomIn: view.scale < MAX_ZOOM - 0.001 };
}

/** El nivel de zoom para mostrar: "1×", "2,6×", "10×". */
export function zoomLabel(scale: number): string {
  const rounded = Math.round(scale * 10) / 10;
  return `${rounded.toLocaleString('es-AR', { maximumFractionDigits: 1 })}×`;
}

/**
 * Los dos círculos de referencia para la escala visible: con zoom se ve menos del gráfico, así
 * que las medidas bajan (20 / 10 mm a 1×, 10 / 5 mm a 2×…) y siguen siendo legibles.
 */
export function visibleRings(extent: number, scale: number): [number, number] {
  return scatterRings(extent / Math.max(1, scale));
}

/**
 * Dónde se ve, con zoom, un punto que sin zoom está en `base`. Las dos posiciones van en
 * unidades del `viewBox` (de 0 a `size`).
 */
export function zoomedPosition(
  base: { x: number; y: number },
  view: ZoomView,
  size: number,
): { x: number; y: number } {
  return {
    x: (view.x + (base.x / size) * view.scale) * size,
    y: (view.y + (base.y / size) * view.scale) * size,
  };
}
