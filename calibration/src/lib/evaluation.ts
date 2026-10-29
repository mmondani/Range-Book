import { pixelToMm, type Calibration, type Pixel } from '@/lib/calibration';
import type { DetectionTuning } from '@/lib/impact-detection';
import type { TargetScoring } from '@/lib/targets';
import {
  IMPACT_TAGS,
  PHOTO_CONDITIONS,
  type ImpactTag,
  type LabeledImpact,
  type PhotoCondition,
} from './dataset';

/**
 * Comparación de la detección con lo marcado a mano. Todo se mide en mm sobre el blanco, con la
 * calibración marcada a mano.
 */

/** Impactos marcados sin etiquetas: se informan aparte de los etiquetados. */
export type TagGroup = ImpactTag | 'untagged';
export const TAG_GROUPS: readonly TagGroup[] = [...IMPACT_TAGS, 'untagged'];

export interface PhotoEvaluation {
  file: string;
  conditions: PhotoCondition[];
  /** Impactos marcados a mano y detectados. */
  truth: number;
  detected: number;
  /** Impactos marcados que tienen una detección a menos de medio agujero. */
  matched: number;
  /** Distancia entre cada impacto encontrado y su detección. */
  errorsMm: number[];
  /** Por etiqueta: impactos marcados y cuántos se encontraron. */
  byTag: Record<TagGroup, { truth: number; found: number }>;
  /** Centro detectado: `undefined` si el blanco no tiene anillos, `null` si no propuso. */
  centerErrorMm?: number | null;
}

/** Empareja cada impacto marcado con a lo sumo una detección, de a pares por distancia. */
export function matchImpacts(
  truth: readonly Pixel[],
  detected: readonly Pixel[],
  maxDistance: number,
): Array<{ truth: number; detected: number; distance: number }> {
  const pairs: Array<{ truth: number; detected: number; distance: number }> = [];
  truth.forEach((t, i) =>
    detected.forEach((d, j) => {
      const distance = Math.hypot(t.x - d.x, t.y - d.y);
      if (distance <= maxDistance) pairs.push({ truth: i, detected: j, distance });
    }),
  );
  pairs.sort((a, b) => a.distance - b.distance);
  const usedTruth = new Set<number>();
  const usedDetected = new Set<number>();
  return pairs.filter((pair) => {
    if (usedTruth.has(pair.truth) || usedDetected.has(pair.detected)) return false;
    usedTruth.add(pair.truth);
    usedDetected.add(pair.detected);
    return true;
  });
}

export function evaluatePhoto(
  photo: {
    file: string;
    conditions: PhotoCondition[];
    calibration: Calibration;
    impacts: readonly LabeledImpact[];
  },
  scoring: TargetScoring,
  detection: { impacts: readonly Pixel[]; center: Pixel | null; holeMm: number },
): PhotoEvaluation {
  const toMm = (pixel: Pixel) => pixelToMm(photo.calibration, pixel);
  const truth = photo.impacts.map(toMm);
  const detected = detection.impacts.map(toMm);
  const matches = matchImpacts(truth, detected, detection.holeMm / 2);
  const found = new Set(matches.map((match) => match.truth));

  const byTag = Object.fromEntries(
    TAG_GROUPS.map((group) => [group, { truth: 0, found: 0 }]),
  ) as PhotoEvaluation['byTag'];
  photo.impacts.forEach((impact, index) => {
    const groups: TagGroup[] = impact.tags.length ? impact.tags : ['untagged'];
    for (const group of groups) {
      byTag[group].truth++;
      if (found.has(index)) byTag[group].found++;
    }
  });

  const evaluation: PhotoEvaluation = {
    file: photo.file,
    conditions: photo.conditions,
    truth: truth.length,
    detected: detected.length,
    matched: matches.length,
    errorsMm: matches.map((match) => match.distance),
    byTag,
  };
  if (scoring === 'rings') {
    // El centro marcado es el (0, 0) de la calibración.
    const center = detection.center && toMm(detection.center);
    evaluation.centerErrorMm = center ? Math.hypot(center.x, center.y) : null;
  }
  return evaluation;
}

// --- Agregados -------------------------------------------------------------------------------

export interface EvaluationMetrics {
  photos: number;
  truth: number;
  detected: number;
  matched: number;
  /** Impactos encontrados: marcados que se detectaron / total marcados (`null` sin marcados). */
  recall: number | null;
  /** Detecciones correctas: detecciones que son un impacto / total detectado. */
  precision: number | null;
  meanErrorMm: number | null;
  maxErrorMm: number | null;
  /** Fotos de blancos con anillos (las que tienen centro para comparar). */
  centerPhotos: number;
  /** De esas, en cuántas no propuso un centro. */
  centerMissing: number;
  centerMeanErrorMm: number | null;
  centerMaxErrorMm: number | null;
}

const ratio = (part: number, total: number) => (total > 0 ? part / total : null);
const mean = (values: readonly number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const max = (values: readonly number[]) => (values.length ? Math.max(...values) : null);

export function summarize(photos: readonly PhotoEvaluation[]): EvaluationMetrics {
  const sum = (pick: (photo: PhotoEvaluation) => number) =>
    photos.reduce((total, photo) => total + pick(photo), 0);
  const truth = sum((photo) => photo.truth);
  const detected = sum((photo) => photo.detected);
  const matched = sum((photo) => photo.matched);
  const errors = photos.flatMap((photo) => photo.errorsMm);
  const rings = photos.filter((photo) => photo.centerErrorMm !== undefined);
  const centerErrors = rings.flatMap((photo) =>
    typeof photo.centerErrorMm === 'number' ? [photo.centerErrorMm] : [],
  );
  return {
    photos: photos.length,
    truth,
    detected,
    matched,
    recall: ratio(matched, truth),
    precision: ratio(matched, detected),
    meanErrorMm: mean(errors),
    maxErrorMm: max(errors),
    centerPhotos: rings.length,
    centerMissing: rings.length - centerErrors.length,
    centerMeanErrorMm: mean(centerErrors),
    centerMaxErrorMm: max(centerErrors),
  };
}

export interface TagMetrics {
  truth: number;
  found: number;
  recall: number | null;
}

export interface EvaluationReport {
  /** ISO 8601. */
  createdAt: string;
  /** Parámetros con los que corrió la detección. */
  tuning: DetectionTuning;
  set: EvaluationMetrics;
  photos: Array<PhotoEvaluation & { metrics: EvaluationMetrics }>;
  /** Por etiqueta solo se puede medir qué se encontró: las detecciones no tienen etiqueta. */
  byTag: Record<TagGroup, TagMetrics>;
  /** Solo las condiciones que tiene alguna foto. */
  byCondition: Partial<Record<PhotoCondition, EvaluationMetrics>>;
  /** Fotos que no se pudieron evaluar, con el motivo. */
  failed: Array<{ file: string; error: string }>;
}

export function buildReport(
  photos: readonly PhotoEvaluation[],
  tuning: DetectionTuning,
  createdAt: Date,
  failed: EvaluationReport['failed'] = [],
): EvaluationReport {
  const byTag = Object.fromEntries(
    TAG_GROUPS.map((group) => {
      const truth = photos.reduce((total, photo) => total + photo.byTag[group].truth, 0);
      const found = photos.reduce((total, photo) => total + photo.byTag[group].found, 0);
      return [group, { truth, found, recall: ratio(found, truth) }];
    }),
  ) as Record<TagGroup, TagMetrics>;
  const byCondition: EvaluationReport['byCondition'] = {};
  for (const condition of PHOTO_CONDITIONS) {
    const withCondition = photos.filter((photo) => photo.conditions.includes(condition));
    if (withCondition.length) byCondition[condition] = summarize(withCondition);
  }
  return {
    createdAt: createdAt.toISOString(),
    tuning,
    set: summarize(photos),
    photos: photos.map((photo) => ({ ...photo, metrics: summarize([photo]) })),
    byTag,
    byCondition,
    failed,
  };
}

/** Nombre del archivo del resultado: `resultados/AAAA-MM-DD-HHMMSS.json` (hora local). */
export function reportPath(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `resultados/${day}-${time}.json`;
}
