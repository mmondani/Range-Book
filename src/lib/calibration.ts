import { formatDecimal, parseDecimal } from './format';
import {
  invert as invertMatrix3,
  localScale,
  multiply,
  project,
  projectCircle,
  scaling,
  type Matrix3,
} from './homography';
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
 * Forma de los anillos de las calibraciones guardadas antes de la inclinación (iteración 000):
 * elipses afines, todas con el mismo centro. El primer eje va en la dirección `angle` (radianes
 * sobre la foto: x a la derecha, y hacia abajo) y el segundo, perpendicular, mide `ratio` veces el
 * primero. Se sigue leyendo para mostrar esos análisis igual que antes; ya no se crea.
 */
export interface CalibrationShape {
  angle: number;
  ratio: number;
}

/**
 * Inclinación del blanco en una foto sacada en ángulo: el blanco gira `|tilt|` radianes hacia la
 * dirección `(x, y)` de la foto (x a la derecha, y hacia abajo). Ese lado queda más cerca de la
 * cámara y se ve más grande; los anillos se ven con perspectiva.
 */
export interface CalibrationTilt {
  x: number;
  y: number;
}

/**
 * Escala de la foto. **Anillos:** el centro y un punto sobre un anillo visible de diámetro
 * conocido; si la foto está en ángulo, la inclinación del blanco (`tilt`, o la forma vieja
 * `shape`). **Sin zonas:** el centro y dos puntos cualesquiera a una distancia conocida.
 */
export type Calibration =
  | ({
      kind: 'ring';
      center: Pixel;
      edge: Pixel;
      diameterMm: number;
      tilt?: CalibrationTilt;
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

/** Inclinación máxima: más allá, la foto está demasiado de costado para medir. */
export const MAX_TILT = (70 * Math.PI) / 180;

/** Por debajo de esto (medio grado), el blanco está de frente. */
const MIN_TILT = (0.5 * Math.PI) / 180;

/** Radianes de inclinación por cada lado mayor de la foto arrastrado (0,02 por cada 1 %). */
const TILT_PER_SIDE = 2;

/**
 * Distancia focal supuesta, en lados mayores de la foto: la de la cámara principal de un celular
 * (≈ 26 mm equivalentes). Con zoom la perspectiva real es menor; la inclinación que ajusta el
 * usuario la compensa en buena parte.
 */
const FOCAL_LENGTH = 0.75;

/** Calibración a medio hacer, en el editor. */
export interface CalibrationDraft {
  center?: Pixel;
  edge?: Pixel;
  a?: Pixel;
  b?: Pixel;
  /** Anillo elegido (blancos con zonas). */
  diameterMm: number;
  /** Inclinación del blanco, si la foto está en ángulo (blancos con zonas). */
  tilt?: CalibrationTilt;
  /** Forma vieja de los anillos, de una calibración guardada antes de la inclinación. */
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
    const { center, edge, diameterMm, tilt, shape } = calibration;
    return {
      ...draft,
      center,
      edge,
      diameterMm,
      ...(tilt ? { tilt } : shape ? { shape } : {}),
    };
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
        // Firestore no acepta `undefined`: sin inclinación, el campo no va. La inclinación
        // reemplaza a la forma vieja.
        ...(draft.tilt ? { tilt: draft.tilt } : draft.shape ? { shape: draft.shape } : {}),
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

/** La inclinación con la que se mide, si la hay (solo blancos con anillos). */
function tiltOf(calibration: Calibration): CalibrationTilt | undefined {
  return calibration.kind === 'ring' ? calibration.tilt : undefined;
}

/**
 * Gira `vector` (en el espacio de la cámara: x a la derecha, y hacia abajo, z hacia adelante)
 * `|tilt|` radianes alrededor del eje de la foto perpendicular a `tilt` (Rodrigues).
 */
function rotate(tilt: CalibrationTilt, vector: readonly [number, number, number]) {
  const angle = Math.hypot(tilt.x, tilt.y);
  if (angle === 0) return vector;
  const axis = [-tilt.y / angle, tilt.x / angle, 0] as const;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dot = axis[0] * vector[0] + axis[1] * vector[1];
  const cross = [
    axis[1] * vector[2],
    -axis[0] * vector[2],
    axis[0] * vector[1] - axis[1] * vector[0],
  ];
  const turned = (k: 0 | 1 | 2) => vector[k] * cos + cross[k]! * sin + axis[k] * dot * (1 - cos);
  return [turned(0), turned(1), turned(2)] as const;
}

/**
 * Homografía de la foto inclinada. Cámara estenopeica con el punto principal en el centro de la
 * foto; el blanco es un plano girado `tilt` cuyo centro cae sobre el marcador del centro. La escala
 * sale de que el punto del anillo esté sobre el anillo elegido.
 */
function tiltedHomography(
  calibration: Extract<Calibration, { kind: 'ring' }>,
  tilt: CalibrationTilt,
): Matrix3 {
  const { center, edge, diameterMm, width, height } = calibration;
  const focal = FOCAL_LENGTH * Math.max(width, height);
  const px = width / 2;
  const py = height / 2;
  const right = rotate(tilt, [1, 0, 0]); // x del blanco
  const up = rotate(tilt, [0, -1, 0]); // y del blanco (hacia arriba)
  const toCenter = [center.x - px, center.y - py, focal] as const;
  const camera: Matrix3 = [focal, 0, px, 0, focal, py, 0, 0, 1];
  const plane = multiply(camera, [
    right[0],
    up[0],
    toCenter[0],
    right[1],
    up[1],
    toCenter[1],
    right[2],
    up[2],
    toCenter[2],
  ]);
  const onPlane = project(invertMatrix3(plane), edge);
  return multiply(plane, scaling(Math.hypot(onPlane.x, onPlane.y) / (diameterMm / 2)));
}

/** mm desde el centro del blanco (y hacia arriba) → píxeles de la foto, como homografía. */
function homography(calibration: Calibration): Matrix3 {
  const tilt = tiltOf(calibration);
  if (calibration.kind === 'ring' && tilt) return tiltedHomography(calibration, tilt);
  const m = mmToPixelMatrix(calibration);
  const { x, y } = calibration.center;
  return [m[0], m[1], x, m[2], m[3], y, 0, 0, 1];
}

/**
 * Milímetros que representa un píxel de la foto, alrededor del centro del blanco. Con los anillos
 * deformados o inclinados depende de la dirección: es el promedio (la raíz de la relación de
 * áreas).
 */
export function mmPerPixel(calibration: Calibration): number {
  return 1 / localScale(homography(calibration), { x: 0, y: 0 });
}

/** Punto de la foto → mm desde el centro del blanco (y hacia arriba). */
export function pixelToMm(calibration: Calibration, pixel: Pixel): TargetPoint {
  return project(invertMatrix3(homography(calibration)), pixel);
}

/** mm desde el centro del blanco → punto de la foto. */
export function mmToPixel(calibration: Calibration, point: TargetPoint): Pixel {
  return project(homography(calibration), point);
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

/**
 * Cómo se ve en la foto un círculo del blanco de radio `radiusMm` (por defecto, centrado). Con el
 * blanco inclinado, el centro de la elipse no es la imagen del centro del círculo (perspectiva).
 */
export function pixelEllipse(
  calibration: Calibration,
  radiusMm: number,
  centerMm: TargetPoint = { x: 0, y: 0 },
): PixelEllipse {
  if (tiltOf(calibration)) return projectCircle(homography(calibration), centerMm, radiusMm);
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

/**
 * Inclina el blanco al arrastrar de `from` a `to` (píxeles de la foto): a la inclinación del
 * borrador al empezar (`start`) se le suma el arrastre, en la dirección en que se arrastra. El
 * punto del anillo queda donde está: los anillos siempre pasan por él. Reemplaza a la forma vieja.
 */
export function tiltDraft(
  start: CalibrationDraft,
  from: Pixel,
  to: Pixel,
  size: ImageSize,
): CalibrationDraft {
  const side = Math.max(size.width, size.height);
  const previous = start.tilt ?? { x: 0, y: 0 };
  let tilt = {
    x: previous.x + ((to.x - from.x) / side) * TILT_PER_SIDE,
    y: previous.y + ((to.y - from.y) / side) * TILT_PER_SIDE,
  };
  const angle = Math.hypot(tilt.x, tilt.y);
  if (angle > MAX_TILT) tilt = { x: (tilt.x / angle) * MAX_TILT, y: (tilt.y / angle) * MAX_TILT };
  const untilted = untiltedDraft(start);
  return angle < MIN_TILT ? untilted : { ...untilted, tilt };
}

/** Sin la inclinación (y sin la forma vieja): los anillos vuelven a ser círculos. */
export function untiltedDraft(draft: CalibrationDraft): CalibrationDraft {
  const rest = { ...draft };
  delete rest.tilt;
  delete rest.shape;
  return rest;
}

const TILT_DIRECTIONS = [
  'la derecha',
  'abajo a la derecha',
  'abajo',
  'abajo a la izquierda',
  'la izquierda',
  'arriba a la izquierda',
  'arriba',
  'arriba a la derecha',
];

/** «Inclinación: 30° hacia abajo». La dirección, en octavos de vuelta sobre la foto. */
export function describeTilt(tilt: CalibrationTilt): string {
  const degrees = Math.round((Math.hypot(tilt.x, tilt.y) * 180) / Math.PI);
  const octant = (Math.round(Math.atan2(tilt.y, tilt.x) / (Math.PI / 4)) + 8) % 8;
  return `Inclinación: ${degrees}° hacia ${TILT_DIRECTIONS[octant]}`;
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

/** Inclinación guardada; si está dañada o es mayor que el máximo, el blanco se toma de frente. */
function parseTilt(value: unknown): CalibrationTilt | undefined {
  const { x, y } = (value ?? {}) as Record<string, unknown>;
  if (
    typeof x !== 'number' ||
    !Number.isFinite(x) ||
    typeof y !== 'number' ||
    !Number.isFinite(y)
  ) {
    return undefined;
  }
  const angle = Math.hypot(x, y);
  return angle >= MIN_TILT && angle <= MAX_TILT + 1e-9 ? { x, y } : undefined;
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
      const tilt = parseTilt(data.tilt);
      const shape = parseShape(data.shape);
      calibration = {
        kind: 'ring',
        ...base,
        edge,
        diameterMm: data.diameterMm,
        ...(tilt ? { tilt } : shape ? { shape } : {}),
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
