import { describe, expect, it } from 'vitest';
import { migrateRound, migrateRounds, needsMeanRadius } from './metrics-migration';
import type { RawRound } from './rounds';

/** Ronda guardada antes de la iteración 002: con la distancia media al centro. */
function oldRound(id: string, impacts: { x: number; y: number }[]): RawRound {
  return {
    id,
    targetId: 'issf',
    score: 19,
    analysis: {
      calibration: { kind: 'ring', center: { x: 500, y: 500 } },
      impacts,
      metrics: {
        impacts: impacts.length,
        score: 19,
        groupSizeMm: 46,
        mpi: { x: 0, y: -13 },
        mpiOffsetMm: 13,
        meanDistanceMm: 23,
      },
      scoreConfirmed: true,
    },
  };
}

// PMI en (0, −13): los dos impactos están a 23 mm de él.
const IMPACTS = [
  { x: 0, y: 10 },
  { x: 0, y: -36 },
];

describe('migrateRound', () => {
  it('calcula el radio medio con los impactos y borra la distancia al centro', () => {
    const migrated = migrateRound(oldRound('r1', IMPACTS));
    const metrics = (migrated.analysis as { metrics: Record<string, unknown> }).metrics;
    expect(metrics.meanRadiusMm).toBe(23);
    expect(metrics).not.toHaveProperty('meanDistanceMm');
  });

  it('no toca el resto del snapshot ni de la ronda', () => {
    const round = oldRound('r1', [
      { x: 30, y: 40 },
      { x: 50, y: 40 },
    ]);
    const migrated = migrateRound(round);
    const rest = { ...(round.analysis as { metrics: Record<string, unknown> }).metrics };
    delete rest.meanDistanceMm;
    expect(migrated).toEqual({
      ...round,
      analysis: {
        ...(round.analysis as object),
        metrics: { ...rest, meanRadiusMm: 10 },
      },
    });
  });

  it('el radio medio no depende de dónde cayó el grupo', () => {
    const centered = migrateRound(oldRound('a', IMPACTS));
    const shifted = migrateRound(
      oldRound(
        'b',
        IMPACTS.map(({ x, y }) => ({ x: x + 80, y: y - 50 })),
      ),
    );
    const radius = (round: RawRound) =>
      (round.analysis as { metrics: { meanRadiusMm: number } }).metrics.meanRadiusMm;
    expect(radius(shifted)).toBeCloseTo(radius(centered));
  });

  it('una ronda sin análisis, o ya migrada, queda igual (la misma)', () => {
    const empty: RawRound = { id: 'r2', analysis: null };
    expect(needsMeanRadius(empty)).toBe(false);
    expect(migrateRound(empty)).toBe(empty);
    const migrated = migrateRound(oldRound('r1', IMPACTS));
    expect(needsMeanRadius(migrated)).toBe(false);
    expect(migrateRound(migrated)).toBe(migrated);
  });

  it('sin impactos válidos, el radio medio queda vacío', () => {
    const round = oldRound('r1', []);
    (round.analysis as { impacts: unknown }).impacts = [{ x: 'a' }, null];
    const metrics = (migrateRound(round).analysis as { metrics: Record<string, unknown> }).metrics;
    expect(metrics.meanRadiusMm).toBeNull();
    expect(metrics).not.toHaveProperty('meanDistanceMm');
  });
});

describe('migrateRounds', () => {
  it('migra las rondas que lo necesitan y deja las demás', () => {
    const empty: RawRound = { id: 'r2', analysis: null };
    const rounds = migrateRounds([oldRound('r1', IMPACTS), empty]);
    expect(rounds).toHaveLength(2);
    expect(needsMeanRadius(rounds![0]!)).toBe(false);
    expect(rounds![1]).toBe(empty);
  });

  it('si ninguna lo necesita, devuelve null: no hay que escribir la sesión', () => {
    const migrated = migrateRounds([oldRound('r1', IMPACTS)])!;
    expect(migrateRounds(migrated)).toBeNull();
    expect(migrateRounds([])).toBeNull();
  });
});
