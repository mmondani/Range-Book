import { parseCalibration, type Calibration, type Pixel } from '@/lib/calibration';
import { parseTargetClipboard, type TargetDefinition } from '@/lib/targets';

/**
 * Set de fotos de blancos con la "verdad" marcada a mano: calibración e impactos en píxeles de
 * la foto original. Se guarda como `dataset.json` en la carpeta de las fotos.
 */

export const DATASET_VERSION = 1;
export const DATASET_FILE = 'dataset.json';

/** Sin marcar · en progreso (ya tiene algo marcado) · lista (revisada) · descartada del set. */
export type PhotoStatus = 'pending' | 'in-progress' | 'done' | 'discarded';

export const STATUS_LABELS: Record<PhotoStatus, string> = {
  pending: 'Sin marcar',
  'in-progress': 'En progreso',
  done: 'Lista',
  discarded: 'Descartada',
};

export const IMPACT_TAGS = ['touching', 'outside', 'old'] as const;
export type ImpactTag = (typeof IMPACT_TAGS)[number];

export const TAG_LABELS: Record<ImpactTag, string> = {
  touching: 'Pegado o superpuesto',
  outside: 'Fuera del anillo exterior',
  old: 'De otra ronda',
};

export const PHOTO_CONDITIONS = [
  'even',
  'shadow',
  'flash',
  'angled',
  'blurry',
  'old-holes',
] as const;
export type PhotoCondition = (typeof PHOTO_CONDITIONS)[number];

export const CONDITION_LABELS: Record<PhotoCondition, string> = {
  even: 'Luz pareja',
  shadow: 'Sombra',
  flash: 'Flash',
  angled: 'En ángulo',
  blurry: 'Borrosa',
  'old-holes': 'Papel con agujeros viejos',
};

export interface DatasetTarget extends TargetDefinition {
  id: string;
}

export interface LabeledImpact extends Pixel {
  tags: ImpactTag[];
}

export interface DatasetPhoto {
  /** Nombre del archivo en la carpeta del set: identifica a la foto. */
  file: string;
  /** Tamaño de la foto original, con la orientación EXIF aplicada. */
  width: number;
  height: number;
  status: PhotoStatus;
  caliber: string;
  targetId: string | null;
  shots: number | null;
  /** En píxeles de la foto original. */
  calibration: Calibration | null;
  impacts: LabeledImpact[];
  conditions: PhotoCondition[];
  notes: string;
}

export interface Dataset {
  version: typeof DATASET_VERSION;
  targets: DatasetTarget[];
  photos: DatasetPhoto[];
}

export function emptyDataset(): Dataset {
  return { version: DATASET_VERSION, targets: [], photos: [] };
}

export function serializeDataset(dataset: Dataset): string {
  return `${JSON.stringify(dataset, null, 2)}\n`;
}

// --- Lectura ---------------------------------------------------------------------------------

class DatasetError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function list<T>(value: unknown, where: string, parse: (item: unknown, index: number) => T): T[] {
  if (!Array.isArray(value)) throw new DatasetError(`${where}: falta la lista`);
  return value.map(parse);
}

function oneOf<T extends string>(value: unknown, options: readonly T[], where: string): T {
  if (!options.includes(value as T)) throw new DatasetError(`${where}: valor desconocido`);
  return value as T;
}

function parseTargetEntry(value: unknown, index: number): DatasetTarget {
  const where = `Blanco ${index + 1}`;
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) {
    throw new DatasetError(`${where}: falta el id`);
  }
  // Mismas reglas que al pegarlo desde la app.
  const definition = parseTargetClipboard(
    JSON.stringify({ ...value, rangebook: 'target', version: 1 }),
  );
  if (!definition) throw new DatasetError(`${where}: la definición no es válida`);
  return { id: value.id, ...definition };
}

function parsePhotoEntry(value: unknown, index: number, targets: Set<string>): DatasetPhoto {
  if (!isRecord(value) || typeof value.file !== 'string' || !value.file) {
    throw new DatasetError(`Foto ${index + 1}: falta el nombre del archivo`);
  }
  const where = `Foto «${value.file}»`;
  const { width, height } = value;
  if (!isFiniteNumber(width) || width <= 0 || !isFiniteNumber(height) || height <= 0) {
    throw new DatasetError(`${where}: el tamaño no es válido`);
  }
  if (value.targetId !== null && !targets.has(value.targetId as string)) {
    throw new DatasetError(`${where}: el blanco no existe`);
  }
  const shots = value.shots;
  if (shots !== null && !(Number.isInteger(shots) && (shots as number) > 0)) {
    throw new DatasetError(`${where}: los disparos no son válidos`);
  }
  let calibration: Calibration | null = null;
  if (value.calibration !== null) {
    calibration = parseCalibration(value.calibration);
    if (!calibration) throw new DatasetError(`${where}: la calibración no es válida`);
  }
  const impacts = list(value.impacts, `${where}, impactos`, (impact, i) => {
    if (!isRecord(impact) || !isFiniteNumber(impact.x) || !isFiniteNumber(impact.y)) {
      throw new DatasetError(`${where}: el impacto ${i + 1} no es válido`);
    }
    const tags = list(impact.tags, `${where}, impacto ${i + 1}`, (tag) =>
      oneOf(tag, IMPACT_TAGS, `${where}, impacto ${i + 1}`),
    );
    return { x: impact.x, y: impact.y, tags };
  });
  const conditions = list(value.conditions, `${where}, condiciones`, (condition) =>
    oneOf(condition, PHOTO_CONDITIONS, `${where}, condiciones`),
  );
  if (typeof value.caliber !== 'string' || typeof value.notes !== 'string') {
    throw new DatasetError(`${where}: faltan el calibre o las notas`);
  }
  return {
    file: value.file,
    width,
    height,
    status: oneOf(value.status, Object.keys(STATUS_LABELS) as PhotoStatus[], `${where}, estado`),
    caliber: value.caliber,
    targetId: value.targetId as string | null,
    shots: shots as number | null,
    calibration,
    impacts,
    conditions,
    notes: value.notes,
  };
}

/** Lee un `dataset.json`, o devuelve el error a mostrar si está dañado o es de otra versión. */
export function parseDataset(text: string): { dataset: Dataset } | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'El archivo no es un JSON válido' };
  }
  if (!isRecord(data)) return { error: 'El archivo no es un set de fotos' };
  if (data.version !== DATASET_VERSION) {
    return { error: `Versión del set desconocida: ${String(data.version)}` };
  }
  try {
    const targets = list(data.targets, 'Blancos', parseTargetEntry);
    const ids = new Set(targets.map((target) => target.id));
    const photos = list(data.photos, 'Fotos', (photo, index) => parsePhotoEntry(photo, index, ids));
    return { dataset: { version: DATASET_VERSION, targets, photos } };
  } catch (error) {
    if (error instanceof DatasetError) return { error: error.message };
    throw error;
  }
}

// --- Fotos -----------------------------------------------------------------------------------

export interface PhotoFile {
  file: string;
  width: number;
  height: number;
}

/** Suma las fotos que todavía no están en el set (por nombre de archivo), sin marcar. */
export function addPhotos(dataset: Dataset, files: readonly PhotoFile[]): Dataset {
  const known = new Set(dataset.photos.map((photo) => photo.file));
  const added: DatasetPhoto[] = [];
  for (const { file, width, height } of files) {
    if (known.has(file)) continue;
    known.add(file);
    added.push({
      file,
      width,
      height,
      status: 'pending',
      caliber: '',
      targetId: null,
      shots: null,
      calibration: null,
      impacts: [],
      conditions: [],
      notes: '',
    });
  }
  return added.length ? { ...dataset, photos: [...dataset.photos, ...added] } : dataset;
}

export type PhotoChanges = Partial<Omit<DatasetPhoto, 'file' | 'width' | 'height' | 'status'>>;

/**
 * Cambia los datos de una foto. Una foto sin marcar pasa a "en progreso" en cuanto tiene algo
 * marcado (calibración o impactos); "lista" y "descartada" solo se eligen a mano.
 */
export function updatePhoto(dataset: Dataset, file: string, changes: PhotoChanges): Dataset {
  return {
    ...dataset,
    photos: dataset.photos.map((photo) => {
      if (photo.file !== file) return photo;
      const next = { ...photo, ...changes };
      const marked = next.calibration !== null || next.impacts.length > 0;
      if (next.status === 'pending' && marked) next.status = 'in-progress';
      return next;
    }),
  };
}

/** Marca una foto como lista o descartada, o la devuelve al estado que le corresponde. */
export function setPhotoStatus(
  dataset: Dataset,
  file: string,
  status: 'done' | 'discarded' | 'open',
): Dataset {
  return {
    ...dataset,
    photos: dataset.photos.map((photo) => {
      if (photo.file !== file) return photo;
      if (status !== 'open') return { ...photo, status };
      const marked = photo.calibration !== null || photo.impacts.length > 0;
      return { ...photo, status: marked ? 'in-progress' : 'pending' };
    }),
  };
}

/** Fotos que entran en la evaluación: las listas, con calibración. */
export function evaluablePhotos(dataset: Dataset): DatasetPhoto[] {
  return dataset.photos.filter((photo) => photo.status === 'done' && photo.calibration);
}

// --- Blancos ---------------------------------------------------------------------------------

function slug(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'blanco';
}

/**
 * Suma un blanco pegado desde la app. Si ya hay uno con el mismo nombre, lo reemplaza (las fotos
 * que lo usan pasan a usar la definición nueva).
 */
export function upsertTarget(
  dataset: Dataset,
  definition: TargetDefinition,
): { dataset: Dataset; id: string } {
  const existing = dataset.targets.find((target) => target.name === definition.name);
  if (existing) {
    const targets = dataset.targets.map((target) =>
      target.id === existing.id ? { id: target.id, ...definition } : target,
    );
    return { dataset: { ...dataset, targets }, id: existing.id };
  }
  const ids = new Set(dataset.targets.map((target) => target.id));
  const base = slug(definition.name);
  let id = base;
  for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;
  return { dataset: { ...dataset, targets: [...dataset.targets, { id, ...definition }] }, id };
}
