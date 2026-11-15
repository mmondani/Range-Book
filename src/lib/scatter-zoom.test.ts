import { describe, expect, it } from 'vitest';
import {
  SCATTER_CONTENT,
  SCATTER_FULL_VIEW,
  stepZoom,
  visibleRings,
  zoomedPosition,
  zoomLabel,
  zoomLimits,
} from './scatter-zoom';
import { MAX_ZOOM, panView, pinchView } from './zoom';

describe('stepZoom', () => {
  it('cada paso acerca o aleja ×1,6 alrededor del centro', () => {
    const closer = stepZoom(SCATTER_FULL_VIEW, 1);
    expect(closer.scale).toBeCloseTo(1.6);
    // El centro del recuadro sigue en el centro.
    expect(zoomedPosition({ x: 120, y: 120 }, closer, 240)).toEqual({ x: 120, y: 120 });
    expect(stepZoom(closer, -1).scale).toBeCloseTo(1);
  });

  it('no aleja más que el gráfico entero ni acerca más que el máximo', () => {
    expect(stepZoom(SCATTER_FULL_VIEW, -1)).toEqual(SCATTER_FULL_VIEW);
    let view = SCATTER_FULL_VIEW;
    for (let i = 0; i < 10; i++) view = stepZoom(view, 1);
    expect(view.scale).toBe(MAX_ZOOM);
  });
});

describe('zoomLimits', () => {
  it('a 1× no se puede alejar; en el máximo, no se puede acercar', () => {
    expect(zoomLimits(SCATTER_FULL_VIEW)).toEqual({ canZoomOut: false, canZoomIn: true });
    expect(zoomLimits({ scale: 2, x: 0, y: 0 })).toEqual({ canZoomOut: true, canZoomIn: true });
    expect(zoomLimits({ scale: MAX_ZOOM, x: 0, y: 0 })).toEqual({
      canZoomOut: true,
      canZoomIn: false,
    });
  });
});

describe('zoomLabel', () => {
  it('con un decimal como mucho', () => {
    expect(zoomLabel(1)).toBe('1×');
    expect(zoomLabel(2.56)).toBe('2,6×');
    expect(zoomLabel(10)).toBe('10×');
  });
});

describe('visibleRings', () => {
  it('a 1× alcanzan para todo; con zoom, las medidas bajan a lo que se ve', () => {
    expect(visibleRings(30, 1)).toEqual([20, 40]);
    expect(visibleRings(30, 2)).toEqual([10, 20]);
    expect(visibleRings(30, 4)).toEqual([5, 10]);
  });
});

describe('pellizco y desplazamiento sobre la dispersión', () => {
  it('el punto entre los dedos queda entre los dedos', () => {
    const view = pinchView(
      SCATTER_FULL_VIEW,
      [
        { x: 0.3, y: 0.5 },
        { x: 0.5, y: 0.5 },
      ],
      [
        { x: 0.2, y: 0.5 },
        { x: 0.6, y: 0.5 },
      ],
      SCATTER_CONTENT,
    );
    expect(view.scale).toBeCloseTo(2);
    // El punto (0,4; 0,5) del gráfico (96, 120 en el viewBox de 240) sigue en el medio.
    const at = zoomedPosition({ x: 96, y: 120 }, view, 240);
    expect(at.x).toBeCloseTo(96);
    expect(at.y).toBeCloseTo(120);
  });

  it('desplazar no saca el gráfico de su recuadro', () => {
    const view = panView({ scale: 2, x: -0.5, y: -0.5 }, 5, -5, SCATTER_CONTENT);
    expect(view).toEqual({ scale: 2, x: 0, y: -1 });
  });
});
