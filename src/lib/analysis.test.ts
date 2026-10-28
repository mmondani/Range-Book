import { describe, expect, it } from 'vitest';
import {
  addImpact,
  analysisResult,
  impactHistory,
  impactMismatch,
  parseAnalysis,
  removeImpact,
  savedImpactPixels,
  undoImpacts,
} from './analysis';
import type { Calibration } from './calibration';
import { saveRawAnalysis } from './rounds';
import type { TargetZone } from './target-zones';

/** Foto de 1000 × 1000 px con el anillo de 500 mm a 250 px del centro: 1 mm por px. */
const CALIBRATION: Calibration = {
  kind: 'ring',
  width: 1000,
  height: 1000,
  center: { x: 500, y: 500 },
  edge: { x: 750, y: 500 },
  diameterMm: 500,
};
const ZONES: TargetZone[] = Array.from({ length: 10 }, (_, index) => ({
  score: 10 - index,
  diameterMm: 50 * (index + 1),
}));
const RINGS = { scoring: 'rings' as const, zones: ZONES };

describe('historial de impactos', () => {
  it('"Deshacer" vuelve atrás de a un cambio, incluida una detección completa', () => {
    let history = impactHistory([{ x: 1, y: 1 }]);
    history = addImpact(history, { x: 2, y: 2 });
    history = removeImpact(history, 0);
    expect(history.impacts).toEqual([{ x: 2, y: 2 }]);
    history = undoImpacts(history);
    expect(history.impacts).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
    history = undoImpacts(history);
    expect(history.impacts).toEqual([{ x: 1, y: 1 }]);
    expect(history.past).toEqual([]);
    // Sin historial no cambia.
    expect(undoImpacts(history)).toBe(history);
  });
});

describe('impactMismatch', () => {
  it('avisa si faltan o sobran impactos respecto de los disparos', () => {
    expect(impactMismatch(15, 15)).toBeNull();
    expect(impactMismatch(14, 15)).toMatch(/Agregar/);
    expect(impactMismatch(16, 15)).toMatch(/Quitar/);
  });
});

describe('analysisResult', () => {
  // (500, 490) → (0, 10) mm: 10 puntos. (500, 536) → (0, −36) mm: 9 puntos.
  const impacts = [
    { x: 500, y: 490 },
    { x: 500, y: 536 },
  ];

  it('guarda los impactos en mm desde el centro y un snapshot de las métricas', () => {
    const { analysis } = analysisResult(CALIBRATION, impacts, RINGS, 25, true);
    expect(analysis.calibration).toBe(CALIBRATION);
    expect(analysis.impacts).toEqual([
      { x: 0, y: 10 },
      { x: 0, y: -36 },
    ]);
    expect(analysis.metrics).toMatchObject({ impacts: 2, score: 19, groupSizeMm: 46 });
  });

  it('con el puntaje confirmado, la ronda usa el calculado', () => {
    const result = analysisResult(CALIBRATION, impacts, RINGS, 25, true);
    expect(result.score).toBe(19);
    expect(result.analysis.scoreConfirmed).toBe(true);
  });

  it('sin confirmar, la ronda conserva el puntaje cargado a mano', () => {
    const result = analysisResult(CALIBRATION, impacts, RINGS, 25, false);
    expect(result.score).toBeNull();
    expect(result.analysis.scoreConfirmed).toBe(false);
    expect(result.analysis.metrics.score).toBe(19);
  });

  it('en un blanco sin zonas no hay puntaje calculado que confirmar', () => {
    const result = analysisResult(CALIBRATION, impacts, { scoring: 'none', zones: [] }, 25, true);
    expect(result.score).toBeNull();
    expect(result.analysis.scoreConfirmed).toBe(false);
  });

  it('los impactos guardados vuelven a los mismos píxeles de la foto', () => {
    const { analysis } = analysisResult(CALIBRATION, impacts, RINGS, 25, true);
    expect(savedImpactPixels(analysis)).toEqual(impacts);
    expect(savedImpactPixels(null)).toEqual([]);
  });
});

describe('parseAnalysis', () => {
  it('lee el análisis guardado tal como se escribió', () => {
    const { analysis } = analysisResult(CALIBRATION, [{ x: 500, y: 490 }], RINGS, 25, true);
    expect(parseAnalysis(JSON.parse(JSON.stringify(analysis)))).toEqual(analysis);
  });

  it('tolera datos incompletos o dañados', () => {
    expect(parseAnalysis(null)).toBeNull();
    expect(
      parseAnalysis({ calibration: { kind: 'x' }, impacts: [{ x: 1 }, { x: 2, y: 3 }] }),
    ).toMatchObject({
      calibration: null,
      impacts: [{ x: 2, y: 3 }],
      metrics: { impacts: 1, groupSizeMm: null, distribution: [] },
      scoreConfirmed: false,
    });
  });
});

describe('saveRawAnalysis', () => {
  it('guarda el análisis y el puntaje calculado sin tocar el resto de la ronda', () => {
    const rounds = [
      { id: 'r1', manualScore: 136, score: null, analysis: null, extra: 'x' },
      { id: 'r2', manualScore: 120, score: null, analysis: null },
    ];
    const result = analysisResult(CALIBRATION, [{ x: 500, y: 490 }], RINGS, 25, true);
    const next = saveRawAnalysis(rounds, 'r1', result);
    expect(next?.[0]).toEqual({
      id: 'r1',
      manualScore: 136,
      score: 10,
      analysis: result.analysis,
      extra: 'x',
    });
    expect(next?.[1]).toBe(rounds[1]);
  });

  it('si la ronda ya no existe, no hace nada', () => {
    const result = analysisResult(CALIBRATION, [], RINGS, 25, true);
    expect(saveRawAnalysis([], 'r1', result)).toBeUndefined();
  });
});
