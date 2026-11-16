import { formatFixed } from './format';
import type { MantisShot, MantisShotTrace } from './mantis';
import { problemLabel } from './mantis-problems';

/** Punto de la trayectoria, en mm a la distancia de la ronda: x a la derecha, y hacia arriba. */
export interface TracePoint {
  x: number;
  y: number;
}

export type TracePhase = 'hold' | 'pull' | 'follow';

export const TRACE_PHASE_LABELS: Record<TracePhase, string> = {
  hold: 'Apuntado',
  pull: 'Presión del gatillo',
  follow: 'Seguimiento',
};

/** Tramo de la trayectoria entre dos muestras (incluidas). */
export interface TraceSegment {
  phase: TracePhase;
  from: number;
  to: number;
}

/** Desvío en mm a `distanceM` metros de un giro del arma de `degrees` grados: `tan(θ) · d`. */
export function degreesToMm(degrees: number, distanceM: number): number {
  return Math.tan((degrees * Math.PI) / 180) * distanceM * 1000;
}

/**
 * Trayectoria relativa al punto del disparo (`shotIndex`), en mm a la distancia de la ronda. Un
 * `yaw` mayor es a la derecha y un `pitch` mayor, arriba.
 */
export function relativeTrace(shot: MantisShotTrace, distanceM: number): TracePoint[] {
  const pitch0 = shot.pitch[shot.shotIndex] ?? 0;
  const yaw0 = shot.yaw[shot.shotIndex] ?? 0;
  return shot.pitch.map((pitch, index) => ({
    x: degreesToMm((shot.yaw[index] ?? yaw0) - yaw0, distanceM),
    y: degreesToMm(pitch - pitch0, distanceM),
  }));
}

/** Apuntado (hasta que empieza la presión del gatillo), presión del gatillo y seguimiento. */
export function traceSegments(shot: MantisShotTrace): TraceSegment[] {
  const last = shot.pitch.length - 1;
  const segments: TraceSegment[] = [
    { phase: 'hold', from: shot.holdIndex, to: shot.pullIndex },
    { phase: 'pull', from: shot.pullIndex, to: shot.shotIndex },
    { phase: 'follow', from: shot.shotIndex, to: last },
  ];
  return segments.filter((segment) => segment.to > segment.from);
}

/** Pasos de los círculos de referencia, en mm. */
const RADIUS_STEPS = [2, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

/**
 * Radio del círculo de referencia exterior: un valor redondo que entra el apuntado y la presión
 * del gatillo (con un 10 % de margen). El seguimiento puede salir del cuadro.
 */
export function traceRadius(points: readonly TracePoint[], shot: MantisShotTrace): number {
  let radius = 0;
  for (let index = shot.holdIndex; index <= shot.shotIndex; index++) {
    const point = points[index];
    if (point) radius = Math.max(radius, Math.hypot(point.x, point.y));
  }
  const target = radius * 1.1;
  return RADIUS_STEPS.find((step) => step >= target) ?? Math.ceil(target / 50) * 50;
}

/** Segundos de la muestra respecto del disparo (negativo antes). */
export function sampleTime(index: number, shot: MantisShotTrace, sampleRate: number): number {
  return (index - shot.shotIndex) / sampleRate;
}

/** Duración de la trayectoria, en segundos. */
export function traceDuration(shot: MantisShotTrace, sampleRate: number): number {
  return (shot.pitch.length - 1) / sampleRate;
}

/** Hora de reloj de la dirección del desvío (0° = derecha = 3 h, 90° = arriba = 12 h). */
export function angleClock(angle: number): number {
  const hour = Math.round((90 - angle) / 30) % 12;
  return hour <= 0 ? hour + 12 : hour;
}

export interface MantisStats {
  /** Promedio del puntaje de MantisX. */
  averageScore: number;
  /** Suma de los splits, en segundos. */
  totalTime: number;
  /** Promedio de los splits sin el primer disparo; `null` con un solo disparo. */
  averageSplit: number | null;
  /** Índices de los disparos extremos; `null` si no hay con qué comparar. */
  best: number | null;
  worst: number | null;
  fastest: number | null;
  slowest: number | null;
}

function extremes(values: readonly number[], offset = 0) {
  if (values.length < 2) return { min: null, max: null };
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return { min: null, max: null };
  return { min: values.indexOf(min) + offset, max: values.indexOf(max) + offset };
}

/** Valores calculados de la sesión de MantisX (no se guardan). */
export function mantisStats(shots: readonly MantisShot[]): MantisStats {
  const scores = shots.map((shot) => shot.score);
  const splits = shots.slice(1).map((shot) => shot.split);
  const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
  const score = extremes(scores);
  const split = extremes(splits, 1);
  return {
    averageScore: scores.length > 0 ? sum(scores) / scores.length : 0,
    totalTime: sum(shots.map((shot) => shot.split)),
    averageSplit: splits.length > 0 ? sum(splits) / splits.length : null,
    best: score.max,
    worst: score.min,
    fastest: split.min,
    slowest: split.max,
  };
}

/** Para lectores de pantalla: `Disparo 2: 91,3 puntos, split 3,90 s, Golpear el gatillo`. */
export function shotDescription(shot: MantisShot, index: number): string {
  const split = index === 0 ? 'primer disparo' : `split ${formatFixed(shot.split, 2)} s`;
  return `Disparo ${index + 1}: ${formatFixed(shot.score, 1)} puntos, ${split}, ${problemLabel(shot.problem)}`;
}

/** Resumen de la ronda: `88,3 · 17,1 s` (puntaje promedio · tiempo total). */
export function mantisSummaryText(shots: readonly MantisShot[]): string {
  const stats = mantisStats(shots);
  return `${formatFixed(stats.averageScore, 1)} · ${formatFixed(stats.totalTime, 1)} s`;
}

/** Para lectores de pantalla: `Ver MantisX de la ronda 1: puntaje 88,3, tiempo 17,1 s`. */
export function mantisLinkLabel(shots: readonly MantisShot[], roundNumber: number): string {
  const stats = mantisStats(shots);
  return `Ver MantisX de la ronda ${roundNumber}: puntaje ${formatFixed(stats.averageScore, 1)}, tiempo ${formatFixed(stats.totalTime, 1)} s`;
}
