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
 * Deformación de los anillos en una foto sacada en ángulo: se ven como elipses. El primer eje va
 * en la dirección `angle` (radianes sobre la foto: x a la derecha, y hacia abajo) y el segundo,
 * perpendicular, mide `ratio` veces el primero.
 */
export interface CalibrationShape {
  angle: number;
  ratio: number;
}

/**
 * Escala de la foto. **Anillos:** el centro y un punto sobre un anillo visible de diámetro
 * conocido; si la foto está en ángulo, la forma de los anillos (`shape`). **Sin zonas:** el centro
 * y dos puntos cualesquiera a una distancia conocida.
 */
export type Calibration =
  | ({
      kind: 'ring';
      center: Pixel;
      edge: Pixel;
      diameterMm: number;
      shape?: CalibrationShape;
    } & ImageSize)
  | ({ kind: 'points'; center: Pixel; a: Pixel; b: Pixel; distanceMm: number } & ImageSize);

/** Marcadores que se ubican tocando la foto. */
export type CalibrationMarker = 'center' | 'edge' | 'a' | 'b';

/** Lo que se ajusta tocando la foto: un marcador o la forma de los anillos. */
export type CalibrationTool = CalibrationMarker | 'shape';

export const MARKER_LABELS: Record<CalibrationTool, string> = {
  center: 'Centro',
  edge: 'Anillo',
  a: 'Punto A',
  b: 'Punto B',
  shape: 'Forma',
};

/** Límites de la deformación: más allá, la foto está demasiado inclinada para medir. */
export const MIN_SHAPE_RATIO = 0.2;
export const MAX_SHAPE_RATIO = 5;

/** Calibración a medio hacer, en el editor. */
export interface CalibrationDraft {
  center?: Pixel;
  edge?: Pixel;
  a?: Pixel;
  b?: Pixel;
  /** Anillo elegido (blancos con zonas). */
  diameterMm: number;
  /** Forma de los anillos, si se deformaron (blancos con zonas). */
  shape?: CalibrationShape;
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

/** Herramientas de la calibración: los marcadores y, con anillos, su forma. */
export function calibrationTools(scoring: TargetScoring): CalibrationTool[] {
  const markers: CalibrationTool[] = calibrationMarkers(scoring);
  return scoring === 'rings' ? [...markers, 'shape'] : markers;
}

/** El anillo que se propone por defecto, contando desde el centro. */
export const DEFAULT_RING_FROM_CENTER = 3;

/**
 * Anillo que se propone por defecto: el tercero desde el centro (en un blanco de 10 anillos, el
 * de 8 puntos). Con menos anillos, el más grande.
 */
export function defaultRing(zones: readonly TargetZone[]): number {
  const diameters = zones.map((zone) => zone.diameterMm).sort((a, b) => a - b);
  return diameters[Math.min(DEFAULT_RING_FROM_CENTER, diameters.length) - 1] ?? 0;
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
    const { center, edge, diameterMm, shape } = calibration;
    return { ...draft, center, edge, diameterMm, ...(shape ? { shape } : {}) };
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
      calibration: {
        kind: 'ring',
        ...base,
        edge: draft.edge,
        diameterMm: draft.diameterMm,
        // Firestore no acepta `undefined`: sin deformación, el campo no va.
        ...(draft.shape ? { shape: draft.shape } : {}),
      },
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

// --- Escala ----------------------------------------------------------------------------------

/** Matriz 2 × 2 por filas: `[a, b, c, d]` es `[[a, b], [c, d]]`. */
type Matrix = readonly [number, number, number, number];

const apply = (m: Matrix, { x, y }: Pixel): Pixel => ({
  x: m[0] * x + m[1] * y,
  y: m[2] * x + m[3] * y,
});
const length = ({ x, y }: Pixel) => Math.hypot(x, y);

function invert(m: Matrix): Matrix {
  const det = m[0] * m[3] - m[1] * m[2];
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det];
}

/** Elipse de radio 1 en la dirección `angle` y `ratio` en la perpendicular (sin forma: círculo). */
function shapeMatrix(shape: CalibrationShape | undefined): Matrix {
  if (!shape) return [1, 0, 0, 1];
  const c = Math.cos(shape.angle);
  const s = Math.sin(shape.angle);
  const k = shape.ratio;
  return [c * c + k * s * s, (1 - k) * c * s, (1 - k) * c * s, s * s + k * c * c];
}

/**
 * Cómo se ve un círculo del blanco en la foto: píxeles por mm a lo largo del primer eje y la
 * forma. Con anillos, la elipse pasa por el punto marcado: su tamaño sale de ahí.
 */
function ringGeometry(calibration: Calibration): { pxPerMm: number; shape?: CalibrationShape } {
  if (calibration.kind === 'points') {
    return { pxPerMm: pixelDistance(calibration.a, calibration.b) / calibration.distanceMm };
  }
  const { center, edge, diameterMm, shape } = calibration;
  const offset = { x: edge.x - center.x, y: edge.y - center.y };
  const pxPerMm = length(apply(invert(shapeMatrix(shape)), offset)) / (diameterMm / 2);
  return shape ? { pxPerMm, shape } : { pxPerMm };
}

/** mm desde el centro (y hacia arriba) → desplazamiento en píxeles (y hacia abajo). */
function mmToPixelMatrix(calibration: Calibration): Matrix {
  const { pxPerMm, shape } = ringGeometry(calibration);
  const m = shapeMatrix(shape);
  return [pxPerMm * m[0], -pxPerMm * m[1], pxPerMm * m[2], -pxPerMm * m[3]];
}

/**
 * Milímetros que representa un píxel de la foto. Con los anillos deformados depende de la
 * dirección: es el promedio (la raíz de la relación de áreas).
 */
export function mmPerPixel(calibration: Calibration): number {
  const m = mmToPixelMatrix(calibration);
  return 1 / Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
}

/** Punto de la foto → mm desde el centro del blanco (y hacia arriba). */
export function pixelToMm(calibration: Calibration, pixel: Pixel): TargetPoint {
  const offset = { x: pixel.x - calibration.center.x, y: pixel.y - calibration.center.y };
  return apply(invert(mmToPixelMatrix(calibration)), offset);
}

/** mm desde el centro del blanco → punto de la foto. */
export function mmToPixel(calibration: Calibration, point: TargetPoint): Pixel {
  const offset = apply(mmToPixelMatrix(calibration), point);
  return { x: calibration.center.x + offset.x, y: calibration.center.y + offset.y };
}

/** Largo en píxeles de una medida en mm (el promedio, si los anillos están deformados). */
export function mmToPixelLength(calibration: Calibration, mm: number): number {
  return mm / mmPerPixel(calibration);
}

/** Elipse sobre la foto: radios en píxeles y giro en grados (como `rotate` de SVG). */
export interface PixelEllipse {
  center: Pixel;
  rx: number;
  ry: number;
  angle: number;
}

/** Cómo se ve en la foto un círculo del blanco de radio `radiusMm` (por defecto, centrado). */
export function pixelEllipse(
  calibration: Calibration,
  radiusMm: number,
  centerMm: TargetPoint = { x: 0, y: 0 },
): PixelEllipse {
  const { pxPerMm, shape } = ringGeometry(calibration);
  const radius = radiusMm * pxPerMm;
  return {
    center: mmToPixel(calibration, centerMm),
    rx: radius,
    ry: radius * (shape?.ratio ?? 1),
    angle: shape ? (shape.angle * 180) / Math.PI : 0,
  };
}

/**
 * Deforma los anillos hacia `toward`: en esa dirección pasan por ese punto y en la perpendicular
 * conservan la medida de `start` (el borrador al empezar a arrastrar). El punto del anillo se
 * mueve sobre la nueva elipse, en su misma dirección, para que la escala siga saliendo de él.
 */
export function reshapeDraft(start: CalibrationDraft, toward: Pixel): CalibrationDraft {
  const { center, edge } = start;
  if (!center || !edge) return start;
  const along = { x: toward.x - center.x, y: toward.y - center.y };
  const radius = length(along);
  const offset = { x: edge.x - center.x, y: edge.y - center.y };
  if (radius < MIN_MARKER_DISTANCE_PX || length(offset) < MIN_MARKER_DISTANCE_PX) return start;

  const u = { x: along.x / radius, y: along.y / radius };
  const perpendicular = { x: -u.y, y: u.x };
  // Radio de la elipse actual en la dirección perpendicular.
  const inverse = invert(shapeMatrix(start.shape));
  const across = length(apply(inverse, offset)) / length(apply(inverse, perpendicular));
  const ratio = Math.min(MAX_SHAPE_RATIO, Math.max(MIN_SHAPE_RATIO, across / radius));
  const shape = { angle: Math.atan2(u.y, u.x), ratio };

  const direction = { x: offset.x / length(offset), y: offset.y / length(offset) };
  const p = direction.x * u.x + direction.y * u.y;
  const q = direction.x * perpendicular.x + direction.y * perpendicular.y;
  const distance = 1 / Math.hypot(p / radius, q / (radius * ratio));
  return {
    ...start,
    shape,
    edge: { x: center.x + direction.x * distance, y: center.y + direction.y * distance },
  };
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

/** Forma guardada; si está dañada, los anillos se toman como círculos. */
function parseShape(value: unknown): CalibrationShape | undefined {
  const { angle, ratio } = (value ?? {}) as Record<string, unknown>;
  return typeof angle === 'number' &&
    Number.isFinite(angle) &&
    positive(ratio) &&
    ratio >= MIN_SHAPE_RATIO &&
    ratio <= MAX_SHAPE_RATIO
    ? { angle, ratio }
    : undefined;
}

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
      const shape = parseShape(data.shape);
      calibration = {
        kind: 'ring',
        ...base,
        edge,
        diameterMm: data.diameterMm,
        ...(shape ? { shape } : {}),
      };
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
