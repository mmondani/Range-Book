import { zoneScore, type TargetPoint, type TargetZone } from './target-zones';
import type { TargetScoring } from './targets';

/**
 * Métricas del análisis de un blanco (sección 8 de `shooting_metrics.md`): puntaje y su
 * distribución, tamaño de grupo (mm y MOA), PMI y distancia al centro. Los impactos van en mm
 * desde el centro del blanco (x a la derecha, y hacia arriba).
 */

/** 1 MOA subtiende 0,2909 mm por cada metro de distancia. */
export const MM_PER_MOA_PER_M = 0.2909;

/** Por debajo de este desvío el PMI se considera centrado (sin dirección). */
export const CENTERED_MM = 0.05;

/** Cantidad de impactos en una zona (`score` 0 = fuera de todas). */
export interface ZoneCount {
  score: number;
  count: number;
}

/** Snapshot de las métricas que se guarda con el análisis. */
export interface AnalysisMetrics {
  impacts: number;
  /** `null` si el blanco no tiene zonas (el puntaje es manual). */
  score: number | null;
  /** Impactos × zona más alta. */
  maxScore: number | null;
  /** Puntaje por impacto. */
  averageScore: number | null;
  /** De mayor a menor puntaje; vacía si el blanco no tiene zonas. */
  distribution: ZoneCount[];
  /** Dispersión extrema (centro a centro). `null` con menos de 2 impactos. */
  groupSizeMm: number | null;
  groupSizeMoa: number | null;
  /** Punto medio de impacto. */
  mpi: TargetPoint | null;
  /** Distancia del PMI al centro. */
  mpiOffsetMm: number | null;
  /** Dirección del PMI en horas de reloj (12 arriba, 3 a la derecha); `null` si está centrado. */
  mpiClock: number | null;
  /** Promedio de la distancia de cada impacto al centro. */
  meanDistanceMm: number | null;
}

const distance = (a: TargetPoint, b: TargetPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const ORIGIN: TargetPoint = { x: 0, y: 0 };

/** PMI: promedio de las coordenadas. */
export function meanPoint(points: readonly TargetPoint[]): TargetPoint | null {
  if (points.length === 0) return null;
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), ORIGIN);
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/** Tamaño de grupo: la distancia máxima entre dos impactos. */
export function groupSize(points: readonly TargetPoint[]): number | null {
  if (points.length < 2) return null;
  let max = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      max = Math.max(max, distance(points[i]!, points[j]!));
    }
  }
  return max;
}

/** Medida en mm expresada en MOA a `distanceM` metros. */
export function toMoa(mm: number, distanceM: number): number | null {
  return distanceM > 0 ? mm / (distanceM * MM_PER_MOA_PER_M) : null;
}

/** Dirección de un punto en horas de reloj: 12 arriba, 3 a la derecha, 6 abajo, 9 a la izquierda. */
export function clockHour(point: TargetPoint): number | null {
  if (Math.hypot(point.x, point.y) < CENTERED_MM) return null;
  const degrees = (Math.atan2(point.x, point.y) * 180) / Math.PI;
  const hour = Math.round((degrees + 360) / 30) % 12;
  return hour === 0 ? 12 : hour;
}

/** Promedio de la distancia de cada impacto al centro del blanco. */
export function meanDistance(points: readonly TargetPoint[]): number | null {
  if (points.length === 0) return null;
  return points.reduce((sum, point) => sum + distance(point, ORIGIN), 0) / points.length;
}

/** Distancia máxima de un impacto al PMI: el radio del círculo de grupo que se dibuja. */
export function groupRadius(points: readonly TargetPoint[], center: TargetPoint): number {
  return points.reduce((max, point) => Math.max(max, distance(point, center)), 0);
}

/** Impactos por zona, de mayor a menor puntaje. */
export function scoreDistribution(
  zones: readonly TargetZone[],
  points: readonly TargetPoint[],
): ZoneCount[] {
  const counts = new Map<number, number>();
  for (const point of points) {
    const score = zoneScore(zones, point);
    counts.set(score, (counts.get(score) ?? 0) + 1);
  }
  return [...counts].map(([score, count]) => ({ score, count })).sort((a, b) => b.score - a.score);
}

export function analysisMetrics(
  points: readonly TargetPoint[],
  target: { scoring: TargetScoring; zones: readonly TargetZone[] },
  distanceM: number,
): AnalysisMetrics {
  const scored = target.scoring === 'rings' && target.zones.length > 0;
  const score = scored
    ? points.reduce((sum, point) => sum + zoneScore(target.zones, point), 0)
    : null;
  const topZone = scored ? Math.max(...target.zones.map((zone) => zone.score)) : null;
  const group = groupSize(points);
  const mpi = meanPoint(points);
  return {
    impacts: points.length,
    score,
    maxScore: topZone === null ? null : topZone * points.length,
    averageScore: score !== null && points.length > 0 ? score / points.length : null,
    distribution: scored ? scoreDistribution(target.zones, points) : [],
    groupSizeMm: group,
    groupSizeMoa: group === null ? null : toMoa(group, distanceM),
    mpi,
    mpiOffsetMm: mpi && distance(mpi, ORIGIN),
    mpiClock: mpi && clockHour(mpi),
    meanDistanceMm: meanDistance(points),
  };
}
