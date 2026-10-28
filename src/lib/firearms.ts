import {
  activeItems,
  inventoryList,
  sortByName,
  type Archivable,
  type FieldErrors,
} from './inventory';
import { formatInteger, isValidIsoDate } from './format';
import { storedPhotos, type PhotoDraft } from './photos';

/** Máximos que también exigen las reglas de Firestore. */
export const MAX_PRIOR_SHOTS = 10_000_000;
export const MAX_FIREARM_PHOTOS = 20;
export const MAX_CONFIGURATION_MODIFICATIONS = 50;

/** Nombre de la configuración implícita de cada arma: el arma sin modificaciones. */
export const STOCK_NAME = 'Stock';

/** Sugerencias de calibre; se suman las que ya usó el usuario. */
export const COMMON_CALIBERS = [
  '.22 LR',
  '.380 ACP',
  '9×19 mm',
  '.38 Special',
  '.357 Magnum',
  '.40 S&W',
  '.45 ACP',
  '.223 Rem',
  '5,56×45 mm',
  '.308 Win',
  '7,62×39 mm',
  '12 GA',
] as const;

// --- Armas -----------------------------------------------------------------------------------

/** Lo que se guarda de un arma (sin `id` ni `archived`). */
export interface FirearmInput {
  brand: string;
  model: string;
  caliber: string;
  /** `AAAA-MM-DD`, o `null` si no se cargó. */
  purchaseDate: string | null;
  purchasePlace: string;
  priorShots: number;
  /** Rutas en Storage; la primera es la portada. */
  photos: string[];
}

export interface Firearm extends FirearmInput, Archivable {}

/** Borrador del formulario M10: los campos como se editan. */
export interface FirearmDraft {
  brand: string;
  model: string;
  caliber: string;
  /** `AAAA-MM-DD` o vacío. */
  purchaseDate: string;
  purchasePlace: string;
  /** Texto del campo numérico; vacío equivale a 0. */
  priorShots: string;
  photos: PhotoDraft[];
}

export function firearmName({ brand, model }: Pick<FirearmInput, 'brand' | 'model'>): string {
  return [brand, model].filter(Boolean).join(' ');
}

export function firearmDraft(firearm?: Firearm): FirearmDraft {
  if (!firearm) {
    return {
      brand: '',
      model: '',
      caliber: '',
      purchaseDate: '',
      purchasePlace: '',
      priorShots: '',
      photos: [],
    };
  }
  return {
    brand: firearm.brand,
    model: firearm.model,
    caliber: firearm.caliber,
    purchaseDate: firearm.purchaseDate ?? '',
    purchasePlace: firearm.purchasePlace,
    priorShots: firearm.priorShots > 0 ? String(firearm.priorShots) : '',
    photos: storedPhotos(firearm.photos),
  };
}

/**
 * Tiros previos del borrador; `undefined` si no es un entero válido. Acepta el separador de miles
 * de `es-AR` (`1.200`).
 */
export function parsePriorShots(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return 0;
  const text = /^\d{1,3}(\.\d{3})+$/.test(trimmed) ? trimmed.replace(/\./g, '') : trimmed;
  if (!/^\d+$/.test(text)) return undefined;
  const shots = Number(text);
  return shots <= MAX_PRIOR_SHOTS ? shots : undefined;
}

/** `today` es la fecha local en `AAAA-MM-DD`: la compra no puede ser posterior. */
export function validateFirearm(draft: FirearmDraft, today: string): FieldErrors<FirearmDraft> {
  const errors: FieldErrors<FirearmDraft> = {};
  if (!draft.brand.trim()) errors.brand = 'Ingresá la marca';
  if (!draft.model.trim()) errors.model = 'Ingresá el modelo';
  if (!draft.caliber.trim()) errors.caliber = 'Ingresá el calibre';
  if (draft.purchaseDate) {
    if (!isValidIsoDate(draft.purchaseDate)) errors.purchaseDate = 'Ingresá una fecha válida';
    else if (draft.purchaseDate > today) errors.purchaseDate = 'La fecha no puede ser futura';
  }
  if (parsePriorShots(draft.priorShots) === undefined) {
    errors.priorShots = 'Ingresá un número entero, sin decimales';
  }
  if (draft.photos.length > MAX_FIREARM_PHOTOS) {
    errors.photos = `Podés cargar hasta ${MAX_FIREARM_PHOTOS} fotos`;
  }
  return errors;
}

/** Documento a guardar a partir del borrador ya validado y las rutas de sus fotos ya subidas. */
export function firearmInput(draft: FirearmDraft, photos: string[]): FirearmInput {
  return {
    brand: draft.brand.trim(),
    model: draft.model.trim(),
    caliber: draft.caliber.trim(),
    purchaseDate: draft.purchaseDate || null,
    purchasePlace: draft.purchasePlace.trim(),
    priorShots: parsePriorShots(draft.priorShots) ?? 0,
    photos,
  };
}

/** Calibres comunes más los que ya usó el usuario, sin repetir. */
export function caliberSuggestions(firearms: readonly Pick<FirearmInput, 'caliber'>[]): string[] {
  const seen = new Map<string, string>();
  for (const caliber of [...COMMON_CALIBERS, ...firearms.map((firearm) => firearm.caliber)]) {
    const text = caliber.trim();
    const key = text.toLocaleLowerCase('es-AR');
    if (text && !seen.has(key)) seen.set(key, text);
  }
  return sortByName([...seen.values()], (caliber) => caliber);
}

// --- Modificaciones --------------------------------------------------------------------------

export interface ModificationInput {
  brand: string;
  model: string;
  comments: string;
}

/** Modificación de un arma (`firearms/{id}/modifications/{id}`). */
export interface Modification extends ModificationInput, Archivable {}

export function modificationName({
  brand,
  model,
}: Pick<ModificationInput, 'brand' | 'model'>): string {
  return [brand, model].filter(Boolean).join(' ');
}

export function cleanModification(input: ModificationInput): ModificationInput {
  return { brand: input.brand.trim(), model: input.model.trim(), comments: input.comments.trim() };
}

export function validateModification(input: ModificationInput): FieldErrors<ModificationInput> {
  const { brand, model } = cleanModification(input);
  const errors: FieldErrors<ModificationInput> = {};
  if (!brand) errors.brand = 'Ingresá la marca';
  if (!model) errors.model = 'Ingresá el modelo';
  return errors;
}

// --- Configuraciones -------------------------------------------------------------------------

export interface ConfigurationInput {
  name: string;
  firearmId: string;
  modificationIds: string[];
}

/** Arma virtual: un arma base con una o más de sus modificaciones. */
export interface Configuration extends ConfigurationInput, Archivable {}

/**
 * Opción de configuración de un arma: la "Stock" implícita (sin documento, `id: null`) o una
 * guardada.
 */
export type FirearmConfiguration =
  | { kind: 'stock'; id: null; name: string; firearmId: string; modificationIds: [] }
  | ({ kind: 'saved' } & Configuration);

export function configurationName({ name }: Pick<ConfigurationInput, 'name'>): string {
  return name;
}

export function cleanConfiguration(input: ConfigurationInput): ConfigurationInput {
  return { ...input, name: input.name.trim() };
}

function sameName(a: string, b: string): boolean {
  return a.localeCompare(b, 'es-AR', { sensitivity: 'base' }) === 0;
}

/**
 * `others` son las configuraciones ya guardadas (todas las armas); el nombre no se puede repetir
 * entre las activas de la misma arma, ni ser "Stock".
 */
export function validateConfiguration(
  input: ConfigurationInput,
  others: readonly Configuration[],
  id?: string,
): FieldErrors<ConfigurationInput> {
  const { name, firearmId, modificationIds } = cleanConfiguration(input);
  const errors: FieldErrors<ConfigurationInput> = {};
  if (!name) errors.name = 'Ingresá el nombre';
  else if (sameName(name, STOCK_NAME)) errors.name = '«Stock» es el arma sin modificaciones';
  else if (
    others.some(
      (other) =>
        other.id !== id &&
        !other.archived &&
        other.firearmId === firearmId &&
        sameName(other.name, name),
    )
  ) {
    errors.name = 'Ya hay una configuración con ese nombre para esta arma';
  }
  if (!firearmId) errors.firearmId = 'Elegí el arma';
  if (modificationIds.length === 0) errors.modificationIds = 'Elegí al menos una modificación';
  else if (modificationIds.length > MAX_CONFIGURATION_MODIFICATIONS) {
    errors.modificationIds = `Podés elegir hasta ${MAX_CONFIGURATION_MODIFICATIONS} modificaciones`;
  }
  return errors;
}

/** Agrega o quita una modificación de la configuración, conservando el orden de la lista. */
export function toggleModification(ids: readonly string[], id: string, checked: boolean): string[] {
  const without = ids.filter((current) => current !== id);
  return checked ? [...without, id] : without;
}

export function stockConfiguration(firearmId: string): FirearmConfiguration {
  return { kind: 'stock', id: null, name: STOCK_NAME, firearmId, modificationIds: [] };
}

/**
 * Configuraciones de un arma: primero "Stock" (implícita) y después las guardadas, ordenadas por
 * nombre. Las archivadas se suman al final solo si se piden.
 */
export function firearmConfigurations(
  firearmId: string,
  configurations: readonly Configuration[],
  showArchived = false,
): FirearmConfiguration[] {
  const own = configurations.filter((configuration) => configuration.firearmId === firearmId);
  return [
    stockConfiguration(firearmId),
    ...inventoryList(own, configurationName, showArchived).map(
      (configuration) => ({ kind: 'saved', ...configuration }) as const,
    ),
  ];
}

/**
 * Modificaciones incluidas en una configuración, en el orden en que se eligieron. Las que ya no
 * existen se ignoran; las archivadas se mantienen (la configuración no cambia sola).
 */
export function configurationModifications(
  configuration: Pick<ConfigurationInput, 'modificationIds'>,
  modifications: readonly Modification[],
): Modification[] {
  const byId = new Map(modifications.map((modification) => [modification.id, modification]));
  return configuration.modificationIds.flatMap((id) => {
    const modification = byId.get(id);
    return modification ? [modification] : [];
  });
}

// --- Uso en sesiones -------------------------------------------------------------------------

/** Lo que el inventario necesita de cada sesión: arma, configuración y disparos. */
export interface SessionUsage {
  firearmId: string;
  /** `null` es la configuración "Stock". */
  configurationId: string | null;
  shots: number;
}

export interface AccumulatedShots {
  total: number;
  prior: number;
  /** Disparos registrados en sesiones. */
  sessionShots: number;
  sessions: number;
}

/** Tiros acumulados = tiros previos al registro + disparos de todas las sesiones del arma. */
export function accumulatedShots(
  firearm: Pick<Firearm, 'id' | 'priorShots'>,
  usage: readonly SessionUsage[],
): AccumulatedShots {
  const own = usage.filter((session) => session.firearmId === firearm.id);
  const sessionShots = own.reduce((total, session) => total + session.shots, 0);
  return {
    total: firearm.priorShots + sessionShots,
    prior: firearm.priorShots,
    sessionShots,
    sessions: own.length,
  };
}

function sessionsText(count: number): string {
  return count === 1 ? '1 sesión' : `${formatInteger(count)} sesiones`;
}

/** Desglose de los tiros acumulados: «1.200 previos + 2.282 en 20 sesiones». */
export function accumulatedShotsDetail({
  prior,
  sessionShots,
  sessions,
}: AccumulatedShots): string {
  if (sessions === 0) return prior > 0 ? 'Todos previos al registro' : 'Todavía sin sesiones';
  const fromSessions = `${formatInteger(sessionShots)} en ${sessionsText(sessions)}`;
  return prior > 0
    ? `${formatInteger(prior)} previos + ${fromSessions}`
    : `Todos en ${sessionsText(sessions)}`;
}

/** Sesiones registradas con una configuración (`null` = "Stock" del arma). */
export function configurationSessions(
  usage: readonly SessionUsage[],
  firearmId: string,
  configurationId: string | null,
): number {
  return usage.filter(
    (session) => session.firearmId === firearmId && session.configurationId === configurationId,
  ).length;
}

export function activeModificationCount(modifications: readonly Modification[]): number {
  return activeItems(modifications).length;
}

// --- Lectura de Firestore --------------------------------------------------------------------

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0;
}

export function parseFirearm(id: string, data: Record<string, unknown>): Firearm {
  return {
    id,
    brand: text(data.brand),
    model: text(data.model),
    caliber: text(data.caliber),
    purchaseDate: typeof data.purchaseDate === 'string' ? data.purchaseDate : null,
    purchasePlace: text(data.purchasePlace),
    priorShots: count(data.priorShots),
    photos: strings(data.photos),
    archived: data.archived === true,
  };
}

export function parseModification(id: string, data: Record<string, unknown>): Modification {
  return {
    id,
    brand: text(data.brand),
    model: text(data.model),
    comments: text(data.comments),
    archived: data.archived === true,
  };
}

export function parseConfiguration(id: string, data: Record<string, unknown>): Configuration {
  return {
    id,
    name: text(data.name),
    firearmId: text(data.firearmId),
    modificationIds: strings(data.modificationIds),
    archived: data.archived === true,
  };
}

/** Uso de una sesión a partir de su documento (`rounds[].shots`). */
export function parseSessionUsage(data: Record<string, unknown>): SessionUsage {
  const rounds = Array.isArray(data.rounds) ? (data.rounds as unknown[]) : [];
  return {
    firearmId: text(data.firearmId),
    configurationId: typeof data.configurationId === 'string' ? data.configurationId : null,
    shots: rounds.reduce<number>(
      (total, round) => total + count((round as { shots?: unknown } | null)?.shots),
      0,
    ),
  };
}
