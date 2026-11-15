import { toMoa } from './metrics';
import type { Measure } from './performance';
import { isAnalyzed } from './rounds';
import type { Round } from './sessions';
import type { TargetPoint } from './target-zones';

/**
 * Evolución dentro de una sesión (M03 → pestaña Evolución): las métricas de cada ronda analizada,
 * en orden, para ver cómo cambian el PMI, el grupo y el radio medio de ronda en ronda.
 */

/** Lo que se grafica. */
export type EvolutionMetric = 'mpi' | 'group' | 'radius';

export const EVOLUTION_METRICS: ReadonlyArray<{ value: EvolutionMetric; label: string }> = [
  { value: 'mpi', label: 'PMI' },
  { value: 'group', label: 'Grupo' },
  { value: 'radius', label: 'Radio medio' },
];

/** Una ronda analizada. Las medidas van en mm o en MOA, según la medida pedida. */
export interface EvolutionRound {
  key: string;
  /** Número de la ronda en la sesión (1, 2, …), aunque las anteriores no estén analizadas. */
  number: number;
  /** Desvío del PMI respecto del centro. */
  mpiOffset: number | null;
  /** PMI (x a la derecha, y hacia arriba). */
  mpi: TargetPoint | null;
  /** `null` con menos de 2 impactos. */
  groupSize: number | null;
  /** Distancia media de los impactos al PMI. */
  meanRadius: number | null;
}

/** Rondas analizadas de la sesión. */
export function analyzedRounds(rounds: readonly Round[]): Round[] {
  return rounds.filter(isAnalyzed);
}

/**
 * Medida por defecto: la longitud (en la unidad del perfil) o, si las rondas analizadas son a
 * distancias distintas, MOA, para poder compararlas (como en Rendimiento).
 */
export function defaultEvolutionMeasure(rounds: readonly Round[]): Measure {
  const distances = new Set(analyzedRounds(rounds).map((round) => round.distanceM));
  return distances.size > 1 ? 'moa' : 'length';
}

/** Las métricas de cada ronda analizada, en orden, en mm o en MOA a la distancia de cada ronda. */
export function sessionEvolution(rounds: readonly Round[], measure: Measure): EvolutionRound[] {
  return rounds.flatMap((round, index) => {
    const metrics = round.analysis?.metrics;
    if (!metrics || !isAnalyzed(round)) return [];
    const scale = (mm: number | null) =>
      mm === null ? null : measure === 'moa' ? toMoa(mm, round.distanceM) : mm;
    const { mpi } = metrics;
    const mpiX = mpi && scale(mpi.x);
    const mpiY = mpi && scale(mpi.y);
    return [
      {
        key: round.id,
        number: index + 1,
        mpiOffset: scale(metrics.mpiOffsetMm),
        mpi: mpiX === null || mpiY === null ? null : { x: mpiX, y: mpiY },
        groupSize: scale(metrics.groupSizeMm),
        meanRadius: scale(metrics.meanRadiusMm),
      },
    ];
  });
}

/**
 * Radio del círculo de cada ronda en la dispersión, centrado en su PMI: en Grupo, la mitad del
 * tamaño de grupo (el diámetro es el grupo); en Radio medio, el radio medio. En PMI no hay
 * círculos; una ronda sin el valor (menos de dos impactos) se ve sin círculo.
 */
export function scatterCircle(round: EvolutionRound, metric: EvolutionMetric): number | null {
  if (metric === 'group') return round.groupSize === null ? null : round.groupSize / 2;
  if (metric === 'radius') return round.meanRadius;
  return null;
}
