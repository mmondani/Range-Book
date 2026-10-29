import { describe, expect, it } from 'vitest';
import { mmPerPixel, pixelToMm, type Calibration } from '@/lib/calibration';
import {
  addLabeled,
  applyProposal,
  countWarning,
  labelHistory,
  removeLabeled,
  scaleCalibration,
  toggleTag,
  undoLabels,
} from './labeling';

describe('historial de impactos', () => {
  it('agrega, etiqueta, quita y deshace paso a paso', () => {
    let history = labelHistory();
    history = addLabeled(history, { x: 10, y: 20 });
    history = addLabeled(history, { x: 30, y: 40 });
    history = toggleTag(history, 1, 'touching');
    history = toggleTag(history, 1, 'old');
    expect(history.impacts).toEqual([
      { x: 10, y: 20, tags: [] },
      { x: 30, y: 40, tags: ['touching', 'old'] },
    ]);
    history = toggleTag(history, 1, 'touching');
    expect(history.impacts[1]!.tags).toEqual(['old']);
    history = removeLabeled(history, 0);
    expect(history.impacts).toEqual([{ x: 30, y: 40, tags: ['old'] }]);

    history = undoLabels(history);
    expect(history.impacts).toHaveLength(2);
    // Deshace las tres etiquetas y el segundo impacto.
    for (let i = 0; i < 4; i++) history = undoLabels(history);
    expect(history.impacts).toEqual([{ x: 10, y: 20, tags: [] }]);
    history = undoLabels(undoLabels(history));
    expect(history.impacts).toEqual([]);
  });

  it('la propuesta de la detección reemplaza lo marcado y se puede deshacer', () => {
    const marked = toggleTag(addLabeled(labelHistory(), { x: 1, y: 1 }), 0, 'old');
    const proposed = applyProposal(marked, [
      { x: 5, y: 5 },
      { x: 6, y: 6 },
    ]);
    expect(proposed.impacts).toEqual([
      { x: 5, y: 5, tags: [] },
      { x: 6, y: 6, tags: [] },
    ]);
    expect(undoLabels(proposed).impacts).toEqual(marked.impacts);
  });
});

describe('countWarning', () => {
  it('avisa si faltan o sobran impactos contra los disparos', () => {
    expect(countWarning(5, 5)).toBeNull();
    expect(countWarning(5, null)).toBeNull();
    expect(countWarning(3, 5)).toMatch(/^Faltan 2 impactos/);
    expect(countWarning(6, 5)).toMatch(/^Sobran 1 impactos/);
  });
});

describe('scaleCalibration', () => {
  it('a la mitad de tamaño, los mismos puntos dan los mismos mm', () => {
    const ring: Calibration = {
      kind: 'ring',
      width: 4000,
      height: 3000,
      center: { x: 2000, y: 1500 },
      edge: { x: 2300, y: 1600 },
      diameterMm: 200,
      shape: { angle: 0.4, ratio: 0.8 },
    };
    const half = scaleCalibration(ring, 0.5, 0.5);
    expect(half).toMatchObject({ width: 2000, height: 1500, center: { x: 1000, y: 750 } });
    expect(mmPerPixel(half)).toBeCloseTo(mmPerPixel(ring) * 2, 10);
    const original = pixelToMm(ring, { x: 2500, y: 1200 });
    const scaled = pixelToMm(half, { x: 1250, y: 600 });
    expect(scaled.x).toBeCloseTo(original.x, 10);
    expect(scaled.y).toBeCloseTo(original.y, 10);
  });

  it('también con dos puntos de referencia', () => {
    const points: Calibration = {
      kind: 'points',
      width: 1000,
      height: 1000,
      center: { x: 500, y: 500 },
      a: { x: 100, y: 500 },
      b: { x: 900, y: 500 },
      distanceMm: 400,
    };
    const scaled = scaleCalibration(points, 2, 2);
    expect(scaled).toMatchObject({ a: { x: 200, y: 1000 }, b: { x: 1800, y: 1000 } });
    expect(mmPerPixel(scaled)).toBeCloseTo(0.25, 10);
  });
});
