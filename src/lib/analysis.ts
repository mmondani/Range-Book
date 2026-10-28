import {
  mmToPixel,
  parseCalibration,
  pixelToMm,
  type Calibration,
  type Pixel,
} from './calibration';
import { analysisMetrics, type AnalysisMetrics, type ZoneCount } from './metrics';
import type { TargetPoint, TargetZone } from './target-zones';
import type { TargetScoring } from './targets';

/** Tope de impactos de un análisis (el documento de la sesión tiene un límite de 1 MB). */
export const MAX_IMPACTS = 200;

/**
 * Análisis guardado en la ronda. Los impactos van en mm desde el centro del blanco; las métricas
 * son un snapshot: si después se edita el blanco, el historial no cambia.
 */
export interface RoundAnalysis {
  /** `null` si la calibración guardada está dañada: hay que volver a calibrar. */
  calibration: Calibration | null;
  impacts: TargetPoint[];
  metrics: AnalysisMetrics;
  /** El usuario confirmó el puntaje calculado como puntaje de la ronda. */
  scoreConfirmed: boolean;
}

/** Lo que el analizador necesita del blanco. */
export type AnalyzedTarget = { scoring: TargetScoring; zones: readonly TargetZone[] };

// --- Editor ----------------------------------------------------------------------------------

/** Impactos del editor, en píxeles de la foto, con el historial para "Deshacer". */
export interface ImpactHistory {
  impacts: Pixel[];
  past: Pixel[][];
}

export function impactHistory(impacts: Pixel[] = []): ImpactHistory {
  return { impacts, past: [] };
}

/** Reemplaza los impactos y guarda los anteriores para poder deshacerlo. */
export function commitImpacts(history: ImpactHistory, impacts: Pixel[]): ImpactHistory {
  return { impacts, past: [...history.past, history.impacts] };
}

export function addImpact(history: ImpactHistory, impact: Pixel): ImpactHistory {
  return commitImpacts(history, [...history.impacts, impact]);
}

export function removeImpact(history: ImpactHistory, index: number): ImpactHistory {
  return commitImpacts(
    history,
    history.impacts.filter((_, i) => i !== index),
  );
}

export function undoImpacts(history: ImpactHistory): ImpactHistory {
  const previous = history.past[history.past.length - 1];
  return previous ? { impacts: previous, past: history.past.slice(0, -1) } : history;
}

/**
 * Impactos de un análisis guardado, en píxeles de la foto. Se editan en píxeles para que, si se
 * corrige la calibración, sigan donde están sobre la foto y solo cambien sus medidas.
 */
export function savedImpactPixels(analysis: RoundAnalysis | null): Pixel[] {
  if (!analysis?.calibration) return [];
  const calibration = analysis.calibration;
  return analysis.impacts.map((point) => mmToPixel(calibration, point));
}

export function impactsInMm(calibration: Calibration, impacts: readonly Pixel[]): TargetPoint[] {
  return impacts.map((impact) => pixelToMm(calibration, impact));
}

/** Aviso cuando los impactos marcados no coinciden con los disparos declarados. */
export function impactMismatch(impacts: number, shots: number): string | null {
  if (impacts === shots) return null;
  return impacts < shots
    ? 'Tocá el blanco en modo Agregar para sumar los faltantes.'
    : 'Usá Quitar para eliminar los sobrantes.';
}

// --- Guardado --------------------------------------------------------------------------------

/** Análisis listo para guardar y el puntaje calculado que pasa a la ronda (si se confirmó). */
export interface AnalysisResult {
  analysis: RoundAnalysis;
  /** Puntaje confirmado; `null` si no se confirmó o el blanco no tiene zonas. */
  score: number | null;
}

/**
 * Arma el análisis a guardar. Si el usuario confirma el puntaje calculado, pasa a ser el puntaje
 * de la ronda; si no, la ronda conserva el puntaje cargado a mano.
 */
export function analysisResult(
  calibration: Calibration,
  impacts: readonly Pixel[],
  target: AnalyzedTarget,
  distanceM: number,
  useCalculatedScore: boolean,
): AnalysisResult {
  const points = impactsInMm(calibration, impacts);
  const metrics = analysisMetrics(points, target, distanceM);
  const confirmed = useCalculatedScore && metrics.score !== null;
  return {
    analysis: { calibration, impacts: points, metrics, scoreConfirmed: confirmed },
    score: confirmed ? metrics.score : null,
  };
}

// --- Lectura de Firestore --------------------------------------------------------------------

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parsePoint(value: unknown): TargetPoint | null {
  const { x, y } = (value ?? {}) as Record<string, unknown>;
  const px = finite(x);
  const py = finite(y);
  return px === null || py === null ? null : { x: px, y: py };
}

function parseDistribution(value: unknown): ZoneCount[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    const { score, count } = (item ?? {}) as Record<string, unknown>;
    return typeof score === 'number' && typeof count === 'number' ? [{ score, count }] : [];
  });
}

function parseMetrics(value: unknown, impacts: number): AnalysisMetrics {
  const data = (value ?? {}) as Record<string, unknown>;
  return {
    impacts: finite(data.impacts) ?? impacts,
    score: finite(data.score),
    maxScore: finite(data.maxScore),
    averageScore: finite(data.averageScore),
    distribution: parseDistribution(data.distribution),
    groupSizeMm: finite(data.groupSizeMm),
    groupSizeMoa: finite(data.groupSizeMoa),
    mpi: parsePoint(data.mpi),
    mpiOffsetMm: finite(data.mpiOffsetMm),
    mpiClock: finite(data.mpiClock),
    meanDistanceMm: finite(data.meanDistanceMm),
  };
}

/** Análisis guardado en la ronda; `null` si no tiene. */
export function parseAnalysis(value: unknown): RoundAnalysis | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const impacts = Array.isArray(data.impacts)
    ? data.impacts.flatMap((item: unknown) => parsePoint(item) ?? [])
    : [];
  return {
    calibration: parseCalibration(data.calibration),
    impacts,
    metrics: parseMetrics(data.metrics, impacts.length),
    scoreConfirmed: data.scoreConfirmed === true,
  };
}
