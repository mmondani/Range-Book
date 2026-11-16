import { describe, expect, it } from 'vitest';
import { MANTIS_EXPORT } from '@/test/mantis-fixture';
import type { MantisShot, MantisShotTrace } from './mantis';
import { parseMantisFile } from './mantis-import';
import { problemLabel } from './mantis-problems';
import {
  angleClock,
  degreesToMm,
  mantisStats,
  relativeTrace,
  sampleTime,
  traceRadius,
  traceSegments,
} from './mantis-trace';

const result = parseMantisFile(JSON.stringify(MANTIS_EXPORT));
if (!result.ok) throw new Error(result.error);
const [first, , last] = result.file.sessions;

const shot = (overrides: Partial<MantisShot> = {}): MantisShot => ({
  pk: 1,
  score: 90,
  split: 3,
  problem: 'GREAT SHOT',
  angle: 0,
  triggerHold: 0.1,
  triggerPull: 0.1,
  cant: null,
  ...overrides,
});

const trace = (pitch: number[], yaw: number[]): MantisShotTrace => ({
  pk: 1,
  pitch,
  yaw,
  holdIndex: 0,
  pullIndex: 1,
  shotIndex: 2,
  absolutePitch: null,
});

describe('degreesToMm', () => {
  it('convierte el giro del arma en mm a la distancia de la ronda', () => {
    expect(degreesToMm(0.1, 5.49)).toBeCloseTo(9.58, 2);
    expect(degreesToMm(-0.1, 25)).toBeCloseTo(-43.63, 2);
    expect(degreesToMm(0, 25)).toBe(0);
  });
});

describe('relativeTrace', () => {
  it('centra la trayectoria en el disparo, con x a la derecha e y hacia arriba', () => {
    const points = relativeTrace(trace([1, 1.1, 1, 0.9], [2, 2, 2.1, 2.1]), 5.49);
    expect(points[2]).toEqual({ x: 0, y: 0 });
    expect(points[0]!.x).toBeCloseTo(-degreesToMm(0.1, 5.49));
    expect(points[1]!.y).toBeCloseTo(degreesToMm(0.1, 5.49));
    expect(points[3]!.y).toBeCloseTo(-degreesToMm(0.1, 5.49));
  });

  it('con un disparo real, el punto del disparo es el origen', () => {
    const shotTrace = last!.trace.shots[0]!;
    const points = relativeTrace(shotTrace, 5.49);
    expect(points).toHaveLength(15);
    expect(points[shotTrace.shotIndex]).toEqual({ x: 0, y: 0 });
  });
});

describe('fases', () => {
  it('divide la trayectoria en apuntado, presión del gatillo y seguimiento', () => {
    expect(traceSegments(last!.trace.shots[0]!)).toEqual([
      { phase: 'hold', from: 0, to: 8 },
      { phase: 'pull', from: 8, to: 10 },
      { phase: 'follow', from: 10, to: 14 },
    ]);
  });

  it('el tiempo es relativo al disparo', () => {
    const shotTrace = last!.trace.shots[0]!;
    expect(sampleTime(10, shotTrace, 400)).toBe(0);
    expect(sampleTime(0, shotTrace, 400)).toBe(-0.025);
  });

  it('elige un radio de referencia redondo que entra el apuntado y la presión', () => {
    const points = [
      { x: 0, y: 8 },
      { x: 3, y: 0 },
      { x: 0, y: 0 },
      { x: 90, y: 90 },
    ];
    expect(traceRadius(points, trace([0, 0, 0, 0], [0, 0, 0, 0]))).toBe(10);
  });
});

describe('mantisStats', () => {
  it('calcula el tiempo total (suma de los splits) y el puntaje promedio', () => {
    const stats = mantisStats(first!.summary.shots);
    expect(stats.totalTime).toBeCloseTo(19.72, 5);
    expect(stats.averageScore).toBeCloseTo(93.89506, 1);
  });

  it('el split promedio no cuenta el primer disparo', () => {
    expect(mantisStats([shot({ split: 0 }), shot({ split: 2 }), shot({ split: 4 })])).toMatchObject(
      { averageSplit: 3, totalTime: 6 },
    );
    expect(mantisStats([shot({ split: 0 })]).averageSplit).toBeNull();
  });

  it('marca el mejor y el peor disparo, y el split más rápido y el más lento', () => {
    const stats = mantisStats(last!.summary.shots);
    // Puntajes 93,52 · 91,31 · 88,09 · 82,68 · 85,85; splits 3,90 · 3,75 · 3,02 · 6,46.
    expect(stats).toMatchObject({ best: 0, worst: 3, fastest: 3, slowest: 4 });
  });

  it('sin con qué comparar no marca extremos', () => {
    expect(mantisStats([shot({ split: 0 })])).toMatchObject({
      best: null,
      worst: null,
      fastest: null,
      slowest: null,
    });
    expect(mantisStats([shot(), shot(), shot()])).toMatchObject({ best: null, fastest: null });
  });
});

describe('angleClock', () => {
  it('pasa la dirección del desvío a hora de reloj', () => {
    expect(angleClock(90)).toBe(12);
    expect(angleClock(0)).toBe(3);
    expect(angleClock(270)).toBe(6);
    expect(angleClock(180)).toBe(9);
    expect(angleClock(69.11)).toBe(1);
    expect(angleClock(313.17)).toBe(5);
    expect(angleClock(330)).toBe(4);
  });
});

describe('problemLabel', () => {
  it('traduce los diagnósticos conocidos y deja los demás tal cual', () => {
    expect(problemLabel('GREAT SHOT')).toBe('Buen disparo');
    expect(problemLabel('BREAKING WRIST UP')).toBe('Quebrar la muñeca hacia arriba');
    expect(problemLabel('NEW PROBLEM')).toBe('NEW PROBLEM');
    expect(problemLabel('')).toBe('Sin diagnóstico');
  });
});
