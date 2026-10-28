import { formatDecimal, parseDecimal } from './format';
import { MAX_REFERENCE_MM, type TargetPoint, type TargetZone } from './target-zones';
import type { TargetScoring } from './targets';

/** Punto sobre la foto, en píxeles de la imagen (x a la derecha, y hacia abajo). */
export interface Pixel {
  x: number;
  y: number;
}

/** Tamaño de la foto sobre la que se calibró. */
export interface ImageSize {
  width: number;
  height: number;
}

/**
 * Escala de la foto. **Anillos:** el centro y un punto sobre un anillo visible de diámetro
 * conocido. **Sin zonas:** el centro y dos puntos cualesquiera a una distancia conocida.
 */
export type Calibration =
  | ({ kind: 'ring'; center: Pixel; edge: Pixel; diameterMm: number } & ImageSize)
  | ({ kind: 'points'; center: Pixel; a: Pixel; b: Pixel; distanceMm: number } & ImageSize);

/** Marcadores que se ubican tocando la foto. */
export type CalibrationMarker = 'center' | 'edge' | 'a' | 'b';

export const MARKER_LABELS: Record<CalibrationMarker, string> = {
  center: 'Centro',
  edge: 'Anillo',
  a: 'Punto A',
  b: 'Punto B',
};

/** Calibración a medio hacer, en el editor. */
export interface CalibrationDraft {
  center?: Pixel;
  edge?: Pixel;
  a?: Pixel;
  b?: Pixel;
  /** Anillo elegido (blancos con zonas). */
  diameterMm: number;
  /** Distancia entre A y B, como se escribe (blancos sin zonas). */
  distance: string;
}

/** Separación mínima entre dos marcadores para que la escala tenga sentido. */
export const MIN_MARKER_DISTANCE_PX = 10;

const pixelDistance = (a: Pixel, b: Pixel) => Math.hypot(a.x - b.x, a.y - b.y);

/** Marcadores que pide cada tipo de blanco, en el orden en que se ubican. */
export function calibrationMarkers(scoring: TargetScoring): CalibrationMarker[] {
  return scoring === 'rings' ? ['center', 'edge'] : ['center', 'a', 'b'];
}

/** Anillo que se propone por defecto: el más grande (el que define el tamaño de referencia). */
export function defaultRing(zones: readonly TargetZone[]): number {
  return zones.reduce((max, zone) => Math.max(max, zone.diameterMm), 0);
}

/** Borrador inicial: vacío o a partir de una calibración guardada. */
export function calibrationDraft(
  target: { scoring: TargetScoring; zones: readonly TargetZone[]; referenceSizeMm: number },
  calibration?: Calibration | null,
): CalibrationDraft {
  const draft: CalibrationDraft = {
    diameterMm: defaultRing(target.zones),
    distance: target.referenceSizeMm > 0 ? formatDecimal(target.referenceSizeMm) : '',
  };
  if (!calibration) return draft;
  if (calibration.kind === 'ring') {
    const { center, edge, diameterMm } = calibration;
    return { ...draft, center, edge, diameterMm };
  }
  const { center, a, b, distanceMm } = calibration;
  return { ...draft, center, a, b, distance: formatDecimal(distanceMm) };
}

/** Próximo marcador que falta ubicar, o `undefined` si están todos. */
export function nextMarker(
  draft: CalibrationDraft,
  scoring: TargetScoring,
): CalibrationMarker | undefined {
  return calibrationMarkers(scoring).find((marker) => !draft[marker]);
}

/**
 * Arma la calibración a partir del borrador, o devuelve el error a mostrar si todavía no se
 * puede: faltan marcadores, están demasiado cerca o la distancia no es válida.
 */
export function buildCalibration(
  draft: CalibrationDraft,
  scoring: TargetScoring,
  size: ImageSize,
): { calibration: Calibration } | { error: string } {
  const { center } = draft;
  if (!center) return { error: 'Tocá el centro del blanco' };
  const base = { center, width: size.width, height: size.height };

  if (scoring === 'rings') {
    if (!draft.edge) return { error: 'Tocá un punto sobre un anillo' };
    if (pixelDistance(center, draft.edge) < MIN_MARKER_DISTANCE_PX) {
      return { error: 'El punto sobre el anillo está demasiado cerca del centro' };
    }
    if (!(draft.diameterMm > 0)) return { error: 'Elegí qué anillo marcaste' };
    return {
      calibration: { kind: 'ring', ...base, edge: draft.edge, diameterMm: draft.diameterMm },
    };
  }

  if (!draft.a || !draft.b) return { error: 'Tocá los dos puntos de referencia' };
  if (pixelDistance(draft.a, draft.b) < MIN_MARKER_DISTANCE_PX) {
    return { error: 'Los dos puntos están demasiado cerca' };
  }
  const distanceMm = parseDecimal(draft.distance);
  if (distanceMm === undefined || distanceMm <= 0 || distanceMm > MAX_REFERENCE_MM) {
    return { error: 'Ingresá la distancia real entre los dos puntos' };
  }
  return { calibration: { kind: 'points', ...base, a: draft.a, b: draft.b, distanceMm } };
}

/** Milímetros que representa un píxel de la foto. */
export function mmPerPixel(calibration: Calibration): number {
  return calibration.kind === 'ring'
    ? calibration.diameterMm / 2 / pixelDistance(calibration.center, calibration.edge)
    : calibration.distanceMm / pixelDistance(calibration.a, calibration.b);
}

/** Punto de la foto → mm desde el centro del blanco (y hacia arriba). */
export function pixelToMm(calibration: Calibration, pixel: Pixel): TargetPoint {
  const scale = mmPerPixel(calibration);
  return {
    x: (pixel.x - calibration.center.x) * scale,
    y: (calibration.center.y - pixel.y) * scale,
  };
}

/** mm desde el centro del blanco → punto de la foto. */
export function mmToPixel(calibration: Calibration, point: TargetPoint): Pixel {
  const scale = mmPerPixel(calibration);
  return {
    x: calibration.center.x + point.x / scale,
    y: calibration.center.y - point.y / scale,
  };
}

/** Radio en píxeles de una medida en mm (anillos calibrados, círculo de grupo). */
export function mmToPixelLength(calibration: Calibration, mm: number): number {
  return mm / mmPerPixel(calibration);
}

/** Calibración del borrador si ya está completa y es válida (para dibujar los anillos en vivo). */
export function previewCalibration(
  draft: CalibrationDraft,
  scoring: TargetScoring,
  size: ImageSize,
): Calibration | undefined {
  const result = buildCalibration(draft, scoring, size);
  return 'calibration' in result ? result.calibration : undefined;
}

// --- Lectura de Firestore --------------------------------------------------------------------

function parsePixel(value: unknown): Pixel | undefined {
  const { x, y } = (value ?? {}) as Record<string, unknown>;
  return typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)
    ? { x, y }
    : undefined;
}

const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/** Calibración guardada; `null` si falta o está dañada. */
export function parseCalibration(value: unknown): Calibration | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const center = parsePixel(data.center);
  if (!center || !positive(data.width) || !positive(data.height)) return null;
  const base = { center, width: data.width, height: data.height };
  let calibration: Calibration | null = null;
  if (data.kind === 'ring') {
    const edge = parsePixel(data.edge);
    if (edge && positive(data.diameterMm)) {
      calibration = { kind: 'ring', ...base, edge, diameterMm: data.diameterMm };
    }
  } else if (data.kind === 'points') {
    const a = parsePixel(data.a);
    const b = parsePixel(data.b);
    if (a && b && positive(data.distanceMm)) {
      calibration = { kind: 'points', ...base, a, b, distanceMm: data.distanceMm };
    }
  }
  // Una escala infinita (marcadores superpuestos) no sirve.
  return calibration && Number.isFinite(mmPerPixel(calibration)) ? calibration : null;
}
