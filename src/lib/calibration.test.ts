import { describe, expect, it } from 'vitest';
import {
  buildCalibration,
  calibrationDraft,
  defaultRing,
  mmPerPixel,
  mmToPixel,
  mmToPixelLength,
  nextMarker,
  parseCalibration,
  pixelToMm,
  type Calibration,
} from './calibration';
import type { TargetZone } from './target-zones';

const SIZE = { width: 1000, height: 800 };
const ZONES: TargetZone[] = Array.from({ length: 10 }, (_, index) => ({
  score: 10 - index,
  diameterMm: 50 * (index + 1),
}));
const RINGS = { scoring: 'rings' as const, zones: ZONES, referenceSizeMm: 500 };
const NONE = { scoring: 'none' as const, zones: [], referenceSizeMm: 460 };

function ring(edge: { x: number; y: number }, diameterMm: number): Calibration {
  return { kind: 'ring', ...SIZE, center: { x: 500, y: 400 }, edge, diameterMm };
}

describe('escala con un anillo de referencia', () => {
  it('sale del diámetro del anillo elegido y de la distancia del centro al punto marcado', () => {
    // El anillo de 500 mm tiene 250 px de radio: 1 mm por px.
    expect(mmPerPixel(ring({ x: 750, y: 400 }, 500))).toBe(1);
    // El mismo punto, pero es el anillo de 200 mm: 0,4 mm por px.
    expect(mmPerPixel(ring({ x: 750, y: 400 }, 200))).toBeCloseTo(0.4, 10);
    // El anillo de 100 mm a 100 px en diagonal (60, 80): 0,5 mm por px.
    expect(mmPerPixel(ring({ x: 560, y: 480 }, 100))).toBeCloseTo(0.5, 10);
  });

  it('convierte píxeles en mm desde el centro, con y hacia arriba, y vuelve', () => {
    const calibration = ring({ x: 750, y: 400 }, 200); // 0,4 mm/px
    expect(pixelToMm(calibration, { x: 500, y: 400 })).toEqual({ x: 0, y: 0 });
    const point = pixelToMm(calibration, { x: 600, y: 300 });
    expect(point.x).toBeCloseTo(40, 10);
    expect(point.y).toBeCloseTo(40, 10);
    const back = mmToPixel(calibration, { x: -20, y: -10 });
    expect(back.x).toBeCloseTo(450, 10);
    expect(back.y).toBeCloseTo(425, 10);
    expect(mmToPixelLength(calibration, 100)).toBeCloseTo(250, 10);
  });
});

describe('escala con dos puntos y una distancia', () => {
  it('sale de la distancia real entre los dos puntos', () => {
    const calibration: Calibration = {
      kind: 'points',
      ...SIZE,
      center: { x: 500, y: 400 },
      a: { x: 270, y: 400 },
      b: { x: 730, y: 400 },
      distanceMm: 460,
    };
    expect(mmPerPixel(calibration)).toBe(1);
    // El centro no tiene que estar entre los dos puntos.
    const offCenter = { ...calibration, a: { x: 0, y: 0 }, b: { x: 300, y: 400 }, distanceMm: 250 };
    expect(mmPerPixel(offCenter)).toBe(0.5);
    expect(pixelToMm(offCenter, { x: 400, y: 600 })).toEqual({ x: -50, y: -100 });
  });
});

describe('buildCalibration', () => {
  it('blanco con anillos: pide el centro, el punto sobre el anillo y el anillo', () => {
    const draft = calibrationDraft(RINGS);
    expect(draft).toEqual({ diameterMm: 500, distance: '500' });
    expect(nextMarker(draft, 'rings')).toBe('center');
    expect(buildCalibration(draft, 'rings', SIZE)).toEqual({ error: 'Tocá el centro del blanco' });

    const withCenter = { ...draft, center: { x: 500, y: 400 } };
    expect(nextMarker(withCenter, 'rings')).toBe('edge');
    expect(buildCalibration(withCenter, 'rings', SIZE)).toEqual({
      error: 'Tocá un punto sobre un anillo',
    });

    const tooClose = { ...withCenter, edge: { x: 505, y: 400 } };
    expect(buildCalibration(tooClose, 'rings', SIZE)).toEqual({
      error: 'El punto sobre el anillo está demasiado cerca del centro',
    });

    const complete = { ...withCenter, edge: { x: 750, y: 400 }, diameterMm: 300 };
    expect(nextMarker(complete, 'rings')).toBeUndefined();
    expect(buildCalibration(complete, 'rings', SIZE)).toEqual({
      calibration: ring({ x: 750, y: 400 }, 300),
    });
  });

  it('blanco sin zonas: pide el centro, dos puntos y su distancia (por defecto, el ancho)', () => {
    const draft = calibrationDraft(NONE);
    expect(draft.distance).toBe('460');
    const points = {
      ...draft,
      center: { x: 500, y: 400 },
      a: { x: 270, y: 400 },
      b: { x: 275, y: 400 },
    };
    expect(buildCalibration(points, 'none', SIZE)).toEqual({
      error: 'Los dos puntos están demasiado cerca',
    });
    const far = { ...points, b: { x: 730, y: 400 } };
    expect(buildCalibration({ ...far, distance: 'abc' }, 'none', SIZE)).toEqual({
      error: 'Ingresá la distancia real entre los dos puntos',
    });
    expect(buildCalibration({ ...far, distance: '230,5' }, 'none', SIZE)).toMatchObject({
      calibration: { kind: 'points', distanceMm: 230.5 },
    });
  });

  it('el borrador de una calibración guardada la reproduce', () => {
    const saved = ring({ x: 750, y: 400 }, 300);
    const draft = calibrationDraft(RINGS, saved);
    expect(buildCalibration(draft, 'rings', SIZE)).toEqual({ calibration: saved });
  });
});

describe('defaultRing', () => {
  it('propone el anillo más grande', () => {
    expect(defaultRing(ZONES)).toBe(500);
    expect(defaultRing([])).toBe(0);
  });
});

describe('parseCalibration', () => {
  it('lee una calibración guardada y descarta las dañadas', () => {
    const saved = ring({ x: 750, y: 400 }, 300);
    expect(parseCalibration(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(parseCalibration(null)).toBeNull();
    expect(parseCalibration({ ...saved, kind: 'otra' })).toBeNull();
    expect(parseCalibration({ ...saved, diameterMm: 0 })).toBeNull();
    expect(parseCalibration({ ...saved, edge: saved.center })).toBeNull();
  });
});
