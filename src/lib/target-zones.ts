import { formatDecimal } from './format';

/** Zona de puntaje de un blanco de anillos concéntricos. */
export interface TargetZone {
  score: number;
  /** Diámetro exterior de la zona. */
  diameterMm: number;
}

/** Punto sobre el blanco en mm desde el centro (x a la derecha, y hacia arriba). */
export interface TargetPoint {
  x: number;
  y: number;
}

/** Máximos que también exigen las reglas de Firestore. */
export const MAX_ZONES = 50;
export const MAX_ZONE_SCORE = 1000;
export const MAX_REFERENCE_MM = 10_000;

/** Errores de una fila del editor de zonas. */
export interface ZoneErrors {
  score?: string;
  diameter?: string;
}

/** Zona tal como se cargó: un valor ausente es un campo vacío o inválido. */
export type ZoneValues = Partial<TargetZone>;

function isValidScore(score: number | undefined): score is number {
  return score !== undefined && Number.isInteger(score) && score >= 0 && score <= MAX_ZONE_SCORE;
}

/**
 * Valida las zonas, fila por fila: puntaje entero, diámetro mayor que 0 y no más grande que la
 * referencia, sin puntajes ni diámetros repetidos, y diámetros crecientes a medida que baja el
 * puntaje. Devuelve un objeto por fila (vacío si la fila está bien).
 */
export function validateZones(zones: readonly ZoneValues[], referenceMm?: number): ZoneErrors[] {
  const errors: ZoneErrors[] = zones.map(() => ({}));
  const seenScores = new Set<number>();
  const seenDiameters = new Set<number>();

  zones.forEach(({ score, diameterMm }, index) => {
    const row = errors[index]!;
    if (!isValidScore(score)) row.score = 'Ingresá un puntaje entero';
    else if (seenScores.has(score)) row.score = 'Puntaje repetido';
    else seenScores.add(score);

    if (diameterMm === undefined || !(diameterMm > 0)) {
      row.diameter = 'Ingresá un diámetro mayor que 0';
    } else if (referenceMm !== undefined && diameterMm > referenceMm) {
      row.diameter = 'No puede superar el tamaño de referencia';
    } else if (seenDiameters.has(diameterMm)) row.diameter = 'Diámetro repetido';
    else seenDiameters.add(diameterMm);
  });

  // El orden solo se revisa entre las filas que ya están bien.
  const valid = zones
    .map((zone, index) => ({ zone, index }))
    .filter(({ index }) => !errors[index]!.score && !errors[index]!.diameter)
    .sort((a, b) => b.zone.score! - a.zone.score!);
  for (let i = 1; i < valid.length; i++) {
    const higher = valid[i - 1]!.zone;
    const current = valid[i]!;
    if (current.zone.diameterMm! <= higher.diameterMm!) {
      errors[current.index]!.diameter =
        `Tiene que ser mayor que el de la zona ${higher.score} (${formatDecimal(higher.diameterMm!)} mm)`;
    }
  }
  return errors;
}

export function hasZoneErrors(errors: readonly ZoneErrors[]): boolean {
  return errors.some((row) => row.score || row.diameter);
}

/**
 * `count` anillos uniformes hasta `referenceMm`: el central vale `count` puntos y cada anillo
 * hacia afuera, uno menos. Los diámetros se redondean a 0,1 mm.
 */
export function generateZones(referenceMm: number, count: number): TargetZone[] {
  return Array.from({ length: count }, (_, index) => ({
    score: count - index,
    diameterMm: Math.round((referenceMm * (index + 1) * 10) / count) / 10,
  }));
}

/** De mayor a menor puntaje (de la zona más chica a la más grande). */
export function sortZones(zones: readonly TargetZone[]): TargetZone[] {
  return [...zones].sort((a, b) => b.score - a.score);
}

/**
 * Puntaje de un impacto: el de la zona más chica que contiene su centro (el borde cuenta como
 * adentro), o 0 si cae fuera de todas. No se usa el diámetro del proyectil.
 */
export function zoneScore(zones: readonly TargetZone[], point: TargetPoint): number {
  const distance = Math.hypot(point.x, point.y);
  let best: TargetZone | undefined;
  for (const zone of zones) {
    if (distance <= zone.diameterMm / 2 && (!best || zone.diameterMm < best.diameterMm)) {
      best = zone;
    }
  }
  return best?.score ?? 0;
}
