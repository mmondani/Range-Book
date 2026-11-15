import { meanRadius } from './metrics';
import type { RawRound } from './rounds';
import type { TargetPoint } from './target-zones';

/**
 * Migración de los análisis guardados (iteración 002, ADR 0008): el radio medio (distancia media
 * de los impactos al PMI) reemplaza a la distancia media al centro. A cada análisis guardado se
 * le calcula `meanRadiusMm` con sus impactos en mm (no hacen falta la calibración ni el blanco) y
 * se le borra `meanDistanceMm`. El resto del snapshot (puntaje, grupo, PMI) no se toca.
 */

type RawObject = Record<string, unknown>;

const isObject = (value: unknown): value is RawObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function storedImpacts(value: unknown): TargetPoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    if (!isObject(item)) return [];
    const { x, y } = item;
    return typeof x === 'number' &&
      Number.isFinite(x) &&
      typeof y === 'number' &&
      Number.isFinite(y)
      ? [{ x, y }]
      : [];
  });
}

/** Si el análisis de la ronda todavía tiene la métrica vieja o le falta el radio medio. */
export function needsMeanRadius(round: RawRound): boolean {
  const { analysis } = round;
  if (!isObject(analysis) || !isObject(analysis.metrics)) return false;
  const { metrics } = analysis;
  return 'meanDistanceMm' in metrics || !('meanRadiusMm' in metrics);
}

/** La ronda con su análisis migrado, o la misma ronda si no hace falta. */
export function migrateRound(round: RawRound): RawRound {
  if (!needsMeanRadius(round)) return round;
  const analysis = round.analysis as RawObject;
  const metrics = { ...(analysis.metrics as RawObject) };
  delete metrics.meanDistanceMm;
  return {
    ...round,
    analysis: {
      ...analysis,
      metrics: { ...metrics, meanRadiusMm: meanRadius(storedImpacts(analysis.impacts)) },
    },
  };
}

/** Las rondas de una sesión migradas, o `null` si ninguna lo necesita (no hay que escribir). */
export function migrateRounds(rounds: readonly RawRound[]): RawRound[] | null {
  if (!rounds.some(needsMeanRadius)) return null;
  return rounds.map(migrateRound);
}
