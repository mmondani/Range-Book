import { describe, expect, it } from 'vitest';
import type { Calibration, Pixel } from './calibration';
import { syntheticTarget } from '@/test/synthetic-target';
import {
  DEFAULT_TUNING,
  detectImpacts,
  detectImpactsInPhoto,
  detectionOptions,
  detectionScale,
  holeDiameterMm,
} from './impact-detection';

const HOLE_ON_PAPER = 40;
const HOLE_ON_BLACK = 200;

function expectNear(found: Pixel[], expected: Pixel[]) {
  expect(found).toHaveLength(expected.length);
  for (const point of expected) {
    const match = found.find((item) => Math.hypot(item.x - point.x, item.y - point.y) <= 1.5);
    expect(match, `impacto en (${point.x}, ${point.y})`).toBeDefined();
  }
}

describe('detectImpacts', () => {
  it('encuentra agujeros oscuros sobre el papel y claros sobre el centro negro', () => {
    const target = syntheticTarget()
      .blackDisk(45)
      .ringLine(70)
      .ringLine(95)
      .hole({ x: 40, y: 50 }, HOLE_ON_PAPER)
      .hole({ x: 180, y: 60 }, HOLE_ON_PAPER)
      .hole({ x: 125, y: 110 }, HOLE_ON_BLACK)
      .hole({ x: 100, y: 125 }, HOLE_ON_BLACK);
    const found = detectImpacts(target.image(), { holeDiameterPx: 9 });
    expectNear(found, [
      { x: 40, y: 50 },
      { x: 180, y: 60 },
      { x: 125, y: 110 },
      { x: 100, y: 125 },
    ]);
  });

  it('encuentra un agujero que corta la línea de un anillo', () => {
    const target = syntheticTarget().ringLine(80).hole({ x: 200, y: 120 }, HOLE_ON_PAPER);
    expectNear(detectImpacts(target.image(), { holeDiameterPx: 9 }), [{ x: 200, y: 120 }]);
  });

  it('no confunde con impactos los anillos, el borde del centro negro ni las líneas finas', () => {
    const target = syntheticTarget().blackDisk(45).ringLine(70).ringLine(95).line(20, 30, 200);
    expect(detectImpacts(target.image(), { holeDiameterPx: 9 })).toEqual([]);
  });

  it('descarta manchas mucho más grandes que un agujero', () => {
    const target = syntheticTarget().hole({ x: 60, y: 60 }, HOLE_ON_PAPER, 20);
    expect(detectImpacts(target.image(), { holeDiameterPx: 9 })).toEqual([]);
  });

  it('solo busca dentro de la zona calibrada', () => {
    const target = syntheticTarget()
      .hole({ x: 120, y: 100 }, HOLE_ON_PAPER)
      .hole({ x: 20, y: 20 }, HOLE_ON_PAPER);
    const found = detectImpacts(target.image(), {
      holeDiameterPx: 9,
      region: { center: target.center, radius: 60 },
    });
    expectNear(found, [{ x: 120, y: 100 }]);
  });

  it('una foto en blanco no tiene impactos', () => {
    expect(detectImpacts(syntheticTarget().image(), { holeDiameterPx: 9 })).toEqual([]);
  });

  it('con otros parámetros cambia lo que encuentra', () => {
    const target = syntheticTarget().hole({ x: 60, y: 60 }, HOLE_ON_PAPER);
    expect(detectImpacts(target.image(), { holeDiameterPx: 9 })).toHaveLength(1);
    // Un umbral mayor que el contraste del agujero (≈ 190) no ve nada.
    expect(
      detectImpacts(target.image(), { holeDiameterPx: 9, tuning: { threshold: 250 } }),
    ).toEqual([]);
    // Pidiendo una ocupación imposible, ninguna mancha parece un agujero.
    expect(detectImpacts(target.image(), { holeDiameterPx: 9, tuning: { minFill: 1.1 } })).toEqual(
      [],
    );
  });

  it('los parámetros por defecto son los de siempre', () => {
    const target = syntheticTarget()
      .blackDisk(45)
      .ringLine(70)
      .hole({ x: 40, y: 50 }, HOLE_ON_PAPER)
      .hole({ x: 125, y: 110 }, HOLE_ON_BLACK);
    expect(
      detectImpacts(target.image(), { holeDiameterPx: 9, tuning: { ...DEFAULT_TUNING } }),
    ).toEqual(detectImpacts(target.image(), { holeDiameterPx: 9 }));
  });

  it('respeta el tope de impactos', () => {
    const target = syntheticTarget();
    for (let i = 0; i < 5; i++) target.hole({ x: 30 + i * 40, y: 120 }, HOLE_ON_PAPER);
    expect(detectImpacts(target.image(), { holeDiameterPx: 9, maxImpacts: 3 })).toHaveLength(3);
  });
});

describe('holeDiameterMm', () => {
  it('interpreta el calibre en mm o en pulgadas', () => {
    expect(holeDiameterMm('9×19 mm')).toBe(9);
    expect(holeDiameterMm('5.56×45 NATO')).toBe(5.56);
    expect(holeDiameterMm('7,62×39')).toBe(7.62);
    expect(holeDiameterMm('.22 LR')).toBeCloseTo(5.59, 2);
    expect(holeDiameterMm('.380 ACP')).toBeCloseTo(9.65, 2);
    expect(holeDiameterMm('45 ACP')).toBeCloseTo(11.43, 2);
    expect(holeDiameterMm('308 Win')).toBeCloseTo(7.82, 2);
  });

  it('si no lo reconoce, usa 9 mm', () => {
    expect(holeDiameterMm('')).toBe(9);
    expect(holeDiameterMm('Magnum')).toBe(9);
  });
});

describe('detectionScale y detectionOptions', () => {
  // Foto de 2000 px con el anillo de 500 mm a 500 px del centro: 0,5 mm por px.
  const calibration: Calibration = {
    kind: 'ring',
    width: 2000,
    height: 2000,
    center: { x: 1000, y: 1000 },
    edge: { x: 1500, y: 1000 },
    diameterMm: 500,
  };

  it('reduce la foto para que un agujero mida unos 10 px, sin agrandarla', () => {
    // Un agujero de 9 mm mide 18 px.
    expect(detectionScale(calibration, 9)).toBeCloseTo(10 / 18, 10);
    // Uno de 4 mm mide 8 px: no se agranda.
    expect(detectionScale(calibration, 4)).toBe(1);
  });

  it('busca solo dentro del anillo exterior (con margen), en la foto reducida', () => {
    const options = detectionOptions(calibration, [{ score: 10, diameterMm: 500 }], 9, 0.5);
    expect(options.holeDiameterPx).toBe(9);
    expect(options.region?.center).toEqual({ x: 500, y: 500 });
    expect(options.region?.radius).toBeCloseTo(262.5, 10);
    // Sin zonas, se busca en toda la foto.
    expect(detectionOptions(calibration, [], 9, 0.5).region).toBeUndefined();
  });
});

describe('detectImpactsInPhoto', () => {
  it('devuelve los impactos en píxeles de la foto calibrada', () => {
    // Foto de 480 px reducida a la mitad: el agujero en (100, 60) de la reducida está en
    // (201, 121) de la original (centro del píxel).
    const calibration: Calibration = {
      kind: 'ring',
      width: 480,
      height: 480,
      center: { x: 240, y: 240 },
      edge: { x: 340, y: 240 },
      diameterMm: 200,
    };
    const target = syntheticTarget().hole({ x: 100, y: 60 }, HOLE_ON_PAPER);
    // 1 mm por px en la original: un agujero de 18 mm mide 9 px en la reducida.
    const [found, ...rest] = detectImpactsInPhoto(target.image(), calibration, [], 18);
    expect(rest).toEqual([]);
    expect(found!.x).toBeCloseTo(201, 0);
    expect(found!.y).toBeCloseTo(121, 0);
  });
});
