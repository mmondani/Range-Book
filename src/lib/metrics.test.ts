import { describe, expect, it } from 'vitest';
import {
  analysisMetrics,
  clockHour,
  groupRadius,
  groupSize,
  meanDistance,
  meanPoint,
  scoreDistribution,
  toMoa,
} from './metrics';
import type { TargetZone } from './target-zones';

/** Anillos de 10 a 7 puntos, de 50 a 200 mm. */
const ZONES: TargetZone[] = [
  { score: 10, diameterMm: 50 },
  { score: 9, diameterMm: 100 },
  { score: 8, diameterMm: 150 },
  { score: 7, diameterMm: 200 },
];
const RINGS = { scoring: 'rings' as const, zones: ZONES };

describe('meanPoint (PMI)', () => {
  it('promedia las coordenadas', () => {
    expect(
      meanPoint([
        { x: 10, y: 0 },
        { x: 20, y: -10 },
        { x: 30, y: -20 },
      ]),
    ).toEqual({ x: 20, y: -10 });
  });

  it('sin impactos no hay PMI', () => {
    expect(meanPoint([])).toBeNull();
  });
});

describe('groupSize', () => {
  it('es la distancia máxima centro a centro entre dos impactos', () => {
    // (3, 4) y (−3, −4) están a 10 mm; (0, 0) queda en el medio.
    expect(
      groupSize([
        { x: 3, y: 4 },
        { x: 0, y: 0 },
        { x: -3, y: -4 },
      ]),
    ).toBe(10);
  });

  it('con menos de dos impactos no hay grupo', () => {
    expect(groupSize([])).toBeNull();
    expect(groupSize([{ x: 5, y: 5 }])).toBeNull();
  });
});

describe('toMoa', () => {
  it('1 MOA son 29,09 mm a 100 m y 7,27 mm a 25 m', () => {
    expect(toMoa(29.09, 100)).toBeCloseTo(1, 6);
    expect(toMoa(7.2725, 25)).toBeCloseTo(1, 6);
  });

  it('el mismo grupo vale más MOA cuanto más cerca se tiró', () => {
    expect(toMoa(50, 25)).toBeCloseTo(6.875, 3);
    expect(toMoa(50, 50)).toBeCloseTo(3.4376, 3);
    expect(toMoa(50, 100)).toBeCloseTo(1.7188, 3);
  });

  it('sin distancia no se puede calcular', () => {
    expect(toMoa(50, 0)).toBeNull();
  });
});

describe('clockHour', () => {
  it('12 arriba, 3 a la derecha, 6 abajo y 9 a la izquierda', () => {
    expect(clockHour({ x: 0, y: 10 })).toBe(12);
    expect(clockHour({ x: 10, y: 0 })).toBe(3);
    expect(clockHour({ x: 0, y: -10 })).toBe(6);
    expect(clockHour({ x: -10, y: 0 })).toBe(9);
  });

  it('redondea a la hora más cercana', () => {
    // 150° desde arriba, en sentido horario.
    expect(clockHour({ x: 10, y: -17.32 })).toBe(5);
    // 330°.
    expect(clockHour({ x: -5, y: 8.66 })).toBe(11);
    // Casi arriba, apenas a la derecha.
    expect(clockHour({ x: 1, y: 100 })).toBe(12);
    // Casi arriba, apenas a la izquierda (≈ 359°).
    expect(clockHour({ x: -1, y: 100 })).toBe(12);
    // PMI (20, −10): 116,6° → 3,9 h.
    expect(clockHour({ x: 20, y: -10 })).toBe(4);
  });

  it('un PMI centrado no tiene dirección', () => {
    expect(clockHour({ x: 0, y: 0 })).toBeNull();
    expect(clockHour({ x: 0.01, y: -0.01 })).toBeNull();
  });
});

describe('meanDistance', () => {
  it('promedia la distancia de cada impacto al centro', () => {
    expect(
      meanDistance([
        { x: 3, y: 4 },
        { x: -6, y: 8 },
      ]),
    ).toBe(7.5);
    expect(meanDistance([])).toBeNull();
  });
});

describe('groupRadius', () => {
  it('es la distancia del impacto más lejano al PMI', () => {
    expect(
      groupRadius(
        [
          { x: 0, y: 0 },
          { x: 6, y: 8 },
        ],
        { x: 3, y: 4 },
      ),
    ).toBe(5);
  });
});

describe('scoreDistribution', () => {
  it('cuenta los impactos por zona, de mayor a menor, con 0 para los de afuera', () => {
    expect(
      scoreDistribution(ZONES, [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 0, y: 10 },
        { x: 300, y: 0 },
      ]),
    ).toEqual([
      { score: 10, count: 2 },
      { score: 9, count: 1 },
      { score: 0, count: 1 },
    ]);
  });
});

describe('analysisMetrics', () => {
  it('calcula todas las métricas de la ronda', () => {
    const points = [
      { x: 0, y: 0 }, // 10
      { x: 30, y: 0 }, // 9
      { x: 0, y: -75 }, // 8 (sobre el borde, cuenta adentro)
      { x: 200, y: 0 }, // fuera
    ];
    const metrics = analysisMetrics(points, RINGS, 25);
    expect(metrics).toMatchObject({
      impacts: 4,
      score: 27,
      maxScore: 40,
      averageScore: 6.75,
      distribution: [
        { score: 10, count: 1 },
        { score: 9, count: 1 },
        { score: 8, count: 1 },
        { score: 0, count: 1 },
      ],
      mpi: { x: 57.5, y: -18.75 },
      mpiClock: 4,
    });
    // De (0, −75) a (200, 0).
    expect(metrics.groupSizeMm).toBeCloseTo(213.6, 1);
    expect(metrics.groupSizeMoa).toBeCloseTo(213.6 / 7.2725, 2);
    expect(metrics.mpiOffsetMm).toBeCloseTo(60.48, 2);
    expect(metrics.meanDistanceMm).toBeCloseTo((0 + 30 + 75 + 200) / 4, 6);
  });

  it('en un blanco sin zonas no calcula el puntaje', () => {
    const metrics = analysisMetrics([{ x: 10, y: 0 }], { scoring: 'none', zones: [] }, 25);
    expect(metrics).toMatchObject({
      impacts: 1,
      score: null,
      maxScore: null,
      averageScore: null,
      distribution: [],
      groupSizeMm: null,
      groupSizeMoa: null,
      mpi: { x: 10, y: 0 },
      mpiOffsetMm: 10,
      mpiClock: 3,
      meanDistanceMm: 10,
    });
  });

  it('sin impactos todo queda vacío', () => {
    expect(analysisMetrics([], RINGS, 25)).toEqual({
      impacts: 0,
      score: 0,
      maxScore: 0,
      averageScore: null,
      distribution: [],
      groupSizeMm: null,
      groupSizeMoa: null,
      mpi: null,
      mpiOffsetMm: null,
      mpiClock: null,
      meanDistanceMm: null,
    });
  });
});
