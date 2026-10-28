import { describe, expect, it } from 'vitest';
import {
  canPan,
  clampView,
  coverScale,
  fitContent,
  fullView,
  initialView,
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

const SQUARE = { width: 1, height: 1 };
// Foto vertical 3:4 en un recuadro cuadrado: entera ocupa 3/4 del ancho.
const PORTRAIT = fitContent(3 / 4, 1);

describe('fitContent y la vista inicial', () => {
  it('la foto entera entra en el recuadro por su lado más largo', () => {
    expect(PORTRAIT).toEqual({ width: 0.75, height: 1 });
    expect(fitContent(4 / 3, 1)).toEqual({ width: 1, height: 0.75 });
    // Foto cuadrada en un recuadro 5:6: entra por el ancho.
    const square = fitContent(1, 5 / 6);
    expect(square.width).toBe(1);
    expect(square.height).toBeCloseTo(5 / 6);
  });

  it('arranca cubriendo el recuadro, centrada en el centro de la foto', () => {
    expect(coverScale(PORTRAIT)).toBeCloseTo(4 / 3);
    // Cubre el ancho; sobra un tercio de alto, repartido arriba y abajo.
    expectView(initialView(PORTRAIT), { scale: 4 / 3, x: 0, y: -1 / 6 });
    expectView(initialView(SQUARE), { scale: 1, x: 0, y: 0 });
  });

  it('la foto entera queda centrada, con bandas a los costados', () => {
    expectView(fullView(PORTRAIT), { scale: 1, x: 0.125, y: 0 });
  });
});

describe('zoomAt', () => {
  it('acerca dejando quieto el punto indicado', () => {
    expectView(zoomAt(fullView(SQUARE), 2, { x: 0.5, y: 0.5 }, SQUARE), {
      scale: 2,
      x: -0.5,
      y: -0.5,
    });
    // Sobre la esquina superior izquierda, no se desplaza.
    expectView(zoomAt(fullView(SQUARE), 2, { x: 0, y: 0 }, SQUARE), { scale: 2, x: 0, y: 0 });
    // El punto (0,75; 0,25) de la foto sigue en el mismo lugar del recuadro.
    const view = zoomAt(fullView(SQUARE), 4, { x: 0.75, y: 0.25 }, SQUARE);
    expect(view.x + 0.75 * view.scale).toBeCloseTo(0.75);
    expect(view.y + 0.25 * view.scale).toBeCloseTo(0.25);
  });

  it('no aleja más que la foto entera ni acerca más que el máximo', () => {
    expectView(
      zoomAt({ scale: 2, x: -0.5, y: -0.5 }, 0.25, { x: 0.5, y: 0.5 }, PORTRAIT),
      fullView(PORTRAIT),
    );
    expect(zoomAt(fullView(SQUARE), 100, { x: 0.5, y: 0.5 }, SQUARE).scale).toBe(MAX_ZOOM);
  });
});

describe('panView, clampView y canPan', () => {
  it('desplaza sin dejar bordes vacíos', () => {
    const view = { scale: 2, x: -0.5, y: -0.5 };
    expectView(panView(view, 0.2, -0.1, SQUARE), { scale: 2, x: -0.3, y: -0.6 });
    expectView(panView(view, 1, -1, SQUARE), { scale: 2, x: 0, y: -1 });
    expectView(panView(fullView(SQUARE), 0.3, 0.3, SQUARE), fullView(SQUARE));
    expectView(clampView({ scale: 0.5, x: 0.2, y: -0.2 }, SQUARE), fullView(SQUARE));
  });

  it('en el eje en que la foto es más chica que el recuadro, queda centrada', () => {
    // Vertical 3:4 a 1,2×: 0,9 de ancho (centrada) y 1,2 de alto (se desplaza).
    expectView(panView({ scale: 1.2, x: 0, y: -0.1 }, 0.3, 0.05, PORTRAIT), {
      scale: 1.2,
      x: 0.05,
      y: -0.05,
    });
  });

  it('isZoomed y canPan', () => {
    expect(isZoomed(fullView(PORTRAIT))).toBe(false);
    expect(canPan(fullView(PORTRAIT), PORTRAIT)).toBe(false);
    // Cubriendo el recuadro ya se puede desplazar en vertical.
    expect(canPan(initialView(PORTRAIT), PORTRAIT)).toBe(true);
    expect(isZoomed({ scale: 1.5, x: 0, y: 0 })).toBe(true);
  });
});

describe('pinchView', () => {
  it('separar los dedos acerca alrededor del punto medio', () => {
    const view = pinchView(
      fullView(SQUARE),
      [
        { x: 0.4, y: 0.5 },
        { x: 0.6, y: 0.5 },
      ],
      [
        { x: 0.3, y: 0.5 },
        { x: 0.7, y: 0.5 },
      ],
      SQUARE,
    );
    expectView(view, { scale: 2, x: -0.5, y: -0.5 });
  });

  it('mover los dos dedos juntos desplaza la foto', () => {
    const view = pinchView(
      { scale: 2, x: -0.5, y: -0.5 },
      [
        { x: 0.4, y: 0.5 },
        { x: 0.6, y: 0.5 },
      ],
      [
        { x: 0.5, y: 0.6 },
        { x: 0.7, y: 0.6 },
      ],
      SQUARE,
    );
    expectView(view, { scale: 2, x: -0.4, y: -0.4 });
  });

  it('acercar y desplazar a la vez: el punto entre los dedos los sigue', () => {
    const view = pinchView(
      fullView(SQUARE),
      [
        { x: 0.4, y: 0.5 },
        { x: 0.6, y: 0.5 },
      ],
      [
        { x: 0.4, y: 0.5 },
        { x: 0.8, y: 0.5 },
      ],
      SQUARE,
    );
    expectView(view, { scale: 2, x: -0.4, y: -0.5 });
  });
});
