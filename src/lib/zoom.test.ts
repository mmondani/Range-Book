import { describe, expect, it } from 'vitest';
import {
  clampView,
  FULL_VIEW,
  isZoomed,
  MAX_ZOOM,
  panView,
  pinchView,
  zoomAt,
  type ZoomView,
} from './zoom';

function expectView(view: ZoomView, expected: ZoomView) {
  expect(view.scale).toBeCloseTo(expected.scale);
  expect(view.x).toBeCloseTo(expected.x);
  expect(view.y).toBeCloseTo(expected.y);
}

describe('zoomAt', () => {
  it('acerca dejando quieto el punto indicado', () => {
    expect(zoomAt(FULL_VIEW, 2, { x: 0.5, y: 0.5 })).toEqual({ scale: 2, x: -0.5, y: -0.5 });
    // Sobre la esquina superior izquierda, no se desplaza.
    expect(zoomAt(FULL_VIEW, 2, { x: 0, y: 0 })).toEqual({ scale: 2, x: 0, y: 0 });
    // El punto (0,75; 0,25) de la foto sigue en el mismo lugar del recuadro.
    const view = zoomAt(FULL_VIEW, 4, { x: 0.75, y: 0.25 });
    expect(view.x + 0.75 * view.scale).toBeCloseTo(0.75);
    expect(view.y + 0.25 * view.scale).toBeCloseTo(0.25);
  });

  it('no aleja más que la foto entera ni acerca más que el máximo', () => {
    expect(zoomAt({ scale: 2, x: -0.5, y: -0.5 }, 0.25, { x: 0.5, y: 0.5 })).toEqual(FULL_VIEW);
    expect(zoomAt(FULL_VIEW, 100, { x: 0.5, y: 0.5 }).scale).toBe(MAX_ZOOM);
  });
});

describe('panView y clampView', () => {
  it('desplaza sin dejar bordes vacíos', () => {
    const view = { scale: 2, x: -0.5, y: -0.5 };
    expect(panView(view, 0.2, -0.1)).toEqual({ scale: 2, x: -0.3, y: -0.6 });
    expect(panView(view, 1, -1)).toEqual({ scale: 2, x: 0, y: -1 });
    expect(panView(FULL_VIEW, 0.3, 0.3)).toEqual(FULL_VIEW);
    expect(clampView({ scale: 0.5, x: 0.2, y: -0.2 })).toEqual(FULL_VIEW);
  });

  it('isZoomed', () => {
    expect(isZoomed(FULL_VIEW)).toBe(false);
    expect(isZoomed({ scale: 1.5, x: 0, y: 0 })).toBe(true);
  });
});

describe('pinchView', () => {
  it('separar los dedos acerca alrededor del punto medio', () => {
    const view = pinchView(
      FULL_VIEW,
      [
        { x: 0.4, y: 0.5 },
        { x: 0.6, y: 0.5 },
      ],
      [
        { x: 0.3, y: 0.5 },
        { x: 0.7, y: 0.5 },
      ],
    );
    expectView(view, { scale: 2, x: -0.5, y: -0.5 });
  });

  it('mover los dos dedos juntos desplaza la foto', () => {
    const start = { scale: 2, x: -0.5, y: -0.5 };
    const view = pinchView(
      start,
      [
        { x: 0.4, y: 0.5 },
        { x: 0.6, y: 0.5 },
      ],
      [
        { x: 0.5, y: 0.6 },
        { x: 0.7, y: 0.6 },
      ],
    );
    expectView(view, { scale: 2, x: -0.4, y: -0.4 });
  });

  it('acercar y desplazar a la vez: el punto entre los dedos los sigue', () => {
    const view = pinchView(
      FULL_VIEW,
      [
        { x: 0.4, y: 0.5 },
        { x: 0.6, y: 0.5 },
      ],
      [
        { x: 0.4, y: 0.5 },
        { x: 0.8, y: 0.5 },
      ],
    );
    expectView(view, { scale: 2, x: -0.4, y: -0.5 });
  });
});
