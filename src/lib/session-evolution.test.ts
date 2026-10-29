import { describe, expect, it } from 'vitest';
import { ROUND_1, ROUND_1_ANALYSIS, ROUND_2 } from '@/test/fake-sessions';
import { MM_PER_MOA_PER_M } from './metrics';
import type { Round } from './sessions';
import { defaultEvolutionMeasure, sessionEvolution } from './session-evolution';

/** Una ronda analizada con métricas propias. */
function analyzed(id: string, distanceM: number, mm: number): Round {
  return {
    ...ROUND_1,
    id,
    distanceM,
    analysis: {
      ...ROUND_1_ANALYSIS,
      metrics: {
        ...ROUND_1_ANALYSIS.metrics,
        groupSizeMm: mm,
        mpi: { x: -mm / 4, y: mm / 2 },
        mpiOffsetMm: mm / 3,
        meanDistanceMm: mm / 5,
      },
    },
  };
}

describe('sessionEvolution', () => {
  it('una entrada por ronda analizada, en orden y con su número en la sesión', () => {
    const rounds = [analyzed('a', 25, 40), ROUND_2, analyzed('c', 25, 30)];
    expect(sessionEvolution(rounds, 'length')).toEqual([
      {
        key: 'a',
        number: 1,
        mpiOffset: 40 / 3,
        mpi: { x: -10, y: 20 },
        groupSize: 40,
        meanDistance: 8,
      },
      {
        key: 'c',
        number: 3,
        mpiOffset: 10,
        mpi: { x: -7.5, y: 15 },
        groupSize: 30,
        meanDistance: 6,
      },
    ]);
  });

  it('en MOA, cada ronda se convierte a su propia distancia', () => {
    const [near, far] = sessionEvolution([analyzed('a', 25, 40), analyzed('b', 50, 40)], 'moa');
    expect(near!.groupSize).toBeCloseTo(40 / (25 * MM_PER_MOA_PER_M));
    expect(far!.groupSize).toBeCloseTo(40 / (50 * MM_PER_MOA_PER_M));
    expect(far!.mpi!.y).toBeCloseTo(20 / (50 * MM_PER_MOA_PER_M));
  });

  it('respeta lo que no se puede medir (grupo con menos de 2 impactos)', () => {
    const single = analyzed('a', 25, 40);
    single.analysis!.metrics = { ...single.analysis!.metrics, groupSizeMm: null };
    expect(sessionEvolution([single], 'moa')[0]!.groupSize).toBeNull();
  });

  it('sin rondas analizadas, vacía', () => {
    expect(sessionEvolution([ROUND_2], 'length')).toEqual([]);
  });
});

describe('defaultEvolutionMeasure', () => {
  it('longitud si las rondas analizadas son a la misma distancia', () => {
    // La ronda sin analizar a otra distancia no cuenta.
    const other = { ...ROUND_2, distanceM: 50 };
    expect(defaultEvolutionMeasure([analyzed('a', 25, 40), other, analyzed('c', 25, 30)])).toBe(
      'length',
    );
  });

  it('MOA si se mezclan distancias', () => {
    expect(defaultEvolutionMeasure([analyzed('a', 25, 40), analyzed('b', 50, 30)])).toBe('moa');
  });
});
