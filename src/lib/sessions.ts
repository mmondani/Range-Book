import {
  configurationModifications,
  firearmName,
  modificationName,
  MAX_CONFIGURATION_MODIFICATIONS,
  STOCK_NAME,
  type Configuration,
  type Firearm,
  type Modification,
} from './firearms';
import { isValidIsoDate } from './format';
import {
  ammunitionName,
  matchesSearch,
  sortByName,
  type Ammunition,
  type Archivable,
  type FieldErrors,
  type Range,
} from './inventory';
import { storedPhotos, type PhotoDraft } from './photos';
import type { Target } from './targets';

/** Máximos que también exigen las reglas de Firestore. */
export const MAX_SESSION_PHOTOS = 20;
export const NOTES_MAX_LENGTH = 2000;
export const MAX_SESSION_ROUNDS = 100;

// --- Modelo ----------------------------------------------------------------------------------

export const WEATHER_OPTIONS = ['sunny', 'cloudy', 'rainy', 'fog', 'windy'] as const;

export type Weather = (typeof WEATHER_OPTIONS)[number];

export const WEATHER_LABELS: Record<Weather, string> = {
  sunny: 'Soleado',
  cloudy: 'Nublado',
  rainy: 'Lluvioso',
  fog: 'Niebla',
  windy: 'Ventoso',
};

/** Copia de una modificación al registrar la sesión: no cambia si después se edita el inventario. */
export interface ModificationSnapshot {
  brand: string;
  model: string;
}

/** Lo que la sesión necesita del análisis de una ronda (el modelo completo llega en el paso 11). */
export interface RoundAnalysis {
  groupSizeMm: number | null;
}

/** Ronda embebida en la sesión. Se cargan desde el detalle (paso 10). */
export interface Round {
  id: string;
  targetId: string;
  distanceM: number;
  shots: number;
  /** Puntaje cargado a mano. */
  manualScore: number | null;
  /** Puntaje calculado por el análisis y confirmado por el usuario. */
  score: number | null;
  photo: string | null;
  comments: string;
  analysis: RoundAnalysis | null;
}

/** Campos de la sesión que se editan en M04 (las rondas se editan aparte). */
export interface SessionFields {
  /** `AAAA-MM-DD`. */
  date: string;
  firearmId: string;
  /** `null` es la configuración "Stock" del arma. */
  configurationId: string | null;
  modificationsSnapshot: ModificationSnapshot[];
  rangeId: string;
  weather: Weather | null;
  ammunitionId: string;
  /** Rutas en Storage. */
  photos: string[];
  notes: string;
}

export interface Session extends SessionFields {
  id: string;
  rounds: Round[];
}

// --- Arma / configuración --------------------------------------------------------------------

/** Valor del select "Arma / configuración": `glock` ("Stock") o `glock/ipsc`. */
export function firearmOptionValue(firearmId: string, configurationId: string | null): string {
  return configurationId ? `${firearmId}/${configurationId}` : firearmId;
}

export function parseFirearmOption(value: string): {
  firearmId: string;
  configurationId: string | null;
} {
  const [firearmId = '', configurationId] = value.split('/');
  return { firearmId, configurationId: configurationId || null };
}

/** «Glock 17 Gen5 · Config. IPSC» o «Glock 17 Gen5 · Stock». */
export function sessionTitle(
  firearm: Pick<Firearm, 'brand' | 'model'> | undefined,
  configuration: Pick<Configuration, 'name'> | undefined | null,
): string {
  const name = firearm ? firearmName(firearm) : 'Arma desconocida';
  return `${name} · ${configuration ? configuration.name : STOCK_NAME}`;
}

export interface FirearmOption {
  value: string;
  label: string;
}

export interface FirearmOptionGroup {
  firearm: Firearm;
  label: string;
  options: FirearmOption[];
}

const visible = <T extends Archivable>(item: T, selectedId: string | null | undefined) =>
  !item.archived || item.id === selectedId;

/**
 * Opciones del select, agrupadas por arma: "Stock" y las configuraciones de cada una. Solo las
 * activas, salvo la ya elegida (para no perder el valor al editar).
 */
export function firearmOptions(
  firearms: readonly Firearm[],
  configurations: readonly Configuration[],
  selected = '',
): FirearmOptionGroup[] {
  const current = parseFirearmOption(selected);
  return sortByName(
    firearms.filter((firearm) => visible(firearm, current.firearmId)),
    firearmName,
  ).map((firearm) => {
    const label = firearmName(firearm);
    const own = sortByName(
      configurations.filter(
        (configuration) =>
          configuration.firearmId === firearm.id && visible(configuration, current.configurationId),
      ),
      (configuration) => configuration.name,
    );
    return {
      firearm,
      label,
      options: [
        { value: firearm.id, label: sessionTitle(firearm, null) },
        ...own.map((configuration) => ({
          value: firearmOptionValue(firearm.id, configuration.id),
          label: sessionTitle(firearm, configuration),
        })),
      ],
    };
  });
}

// --- Personalizaciones -----------------------------------------------------------------------

/** Personalización en el formulario. `id` es `null` si viene de una sesión ya guardada. */
export interface DraftModification extends ModificationSnapshot {
  id: string | null;
}

export function modificationSnapshot(
  modifications: readonly ModificationSnapshot[],
): ModificationSnapshot[] {
  return modifications.map(({ brand, model }) => ({ brand, model }));
}

/** Personalizaciones que precarga una opción del select: las de la configuración ("Stock": ninguna). */
export function optionModifications(
  option: string,
  configurations: readonly Configuration[],
  modifications: readonly Modification[],
): DraftModification[] {
  const { configurationId } = parseFirearmOption(option);
  const configuration = configurations.find((item) => item.id === configurationId);
  if (!configuration) return [];
  return configurationModifications(configuration, modifications).map(({ id, brand, model }) => ({
    id,
    brand,
    model,
  }));
}

function sameModification(a: ModificationSnapshot, b: ModificationSnapshot): boolean {
  return (
    modificationName(a).localeCompare(modificationName(b), 'es-AR', {
      sensitivity: 'base',
    }) === 0
  );
}

/** Modificaciones activas del arma que todavía no están en la sesión (para "Agregar"). */
export function availableModifications(
  selected: readonly DraftModification[],
  modifications: readonly Modification[],
): Modification[] {
  return sortByName(
    modifications.filter(
      (modification) =>
        !modification.archived &&
        !selected.some((item) =>
          item.id ? item.id === modification.id : sameModification(item, modification),
        ),
    ),
    modificationName,
  );
}

// --- Defaults --------------------------------------------------------------------------------

/** La más reciente primero (por fecha; a igual fecha, por id). */
export function sortSessions<T extends Pick<Session, 'id' | 'date'>>(sessions: readonly T[]): T[] {
  return [...sessions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

function lastUsed(
  sessions: readonly Session[],
  pick: (session: Session) => string,
  items: readonly Archivable[],
): string {
  const active = new Set(items.filter((item) => !item.archived).map((item) => item.id));
  return (
    sortSessions(sessions)
      .map(pick)
      .find((id) => active.has(id)) ?? ''
  );
}

/** Polígono de la última sesión (si sigue activo). */
export function lastRangeId(sessions: readonly Session[], ranges: readonly Range[]): string {
  return lastUsed(sessions, (session) => session.rangeId, ranges);
}

/** Munición de la última sesión con esa arma (si sigue activa). */
export function lastAmmunitionId(
  sessions: readonly Session[],
  firearmId: string,
  ammunition: readonly Ammunition[],
): string {
  return lastUsed(
    sessions.filter((session) => session.firearmId === firearmId),
    (session) => session.ammunitionId,
    ammunition,
  );
}

// --- Formulario M04 --------------------------------------------------------------------------

export interface SessionDraft {
  /** Valor del select "Arma / configuración" (`firearmOptionValue`), o vacío. */
  firearm: string;
  modifications: DraftModification[];
  date: string;
  rangeId: string;
  weather: Weather | null;
  ammunitionId: string;
  photos: PhotoDraft[];
  notes: string;
}

/** Sesión nueva: hoy, el último polígono usado y sin arma elegida todavía. */
export function newSessionDraft(
  sessions: readonly Session[],
  ranges: readonly Range[],
  today: string,
): SessionDraft {
  return {
    firearm: '',
    modifications: [],
    date: today,
    rangeId: lastRangeId(sessions, ranges),
    weather: null,
    ammunitionId: '',
    photos: [],
    notes: '',
  };
}

export function sessionDraft(session: Session): SessionDraft {
  return {
    firearm: firearmOptionValue(session.firearmId, session.configurationId),
    modifications: session.modificationsSnapshot.map(({ brand, model }) => ({
      id: null,
      brand,
      model,
    })),
    date: session.date,
    rangeId: session.rangeId,
    weather: session.weather,
    ammunitionId: session.ammunitionId,
    photos: storedPhotos(session.photos),
    notes: session.notes,
  };
}

/**
 * Cambio de arma / configuración: precarga sus personalizaciones y, si el arma cambió, la última
 * munición usada con ella (si no hay, se conserva la elegida).
 */
export function changeFirearm(
  draft: SessionDraft,
  option: string,
  context: {
    sessions: readonly Session[];
    configurations: readonly Configuration[];
    modifications: readonly Modification[];
    ammunition: readonly Ammunition[];
  },
): Partial<SessionDraft> {
  const { firearmId } = parseFirearmOption(option);
  const firearmChanged = firearmId !== parseFirearmOption(draft.firearm).firearmId;
  const ammunitionId = firearmChanged
    ? lastAmmunitionId(context.sessions, firearmId, context.ammunition) || draft.ammunitionId
    : draft.ammunitionId;
  return {
    firearm: option,
    modifications: optionModifications(option, context.configurations, context.modifications),
    ammunitionId,
  };
}

/** `today` es la fecha local en `AAAA-MM-DD`: la sesión no puede ser posterior. */
export function validateSession(draft: SessionDraft, today: string): FieldErrors<SessionDraft> {
  const errors: FieldErrors<SessionDraft> = {};
  if (!parseFirearmOption(draft.firearm).firearmId) {
    errors.firearm = 'Elegí el arma o una configuración';
  }
  if (draft.modifications.length > MAX_CONFIGURATION_MODIFICATIONS) {
    errors.modifications = `Podés elegir hasta ${MAX_CONFIGURATION_MODIFICATIONS} personalizaciones`;
  }
  if (!draft.date) errors.date = 'Ingresá la fecha';
  else if (!isValidIsoDate(draft.date)) errors.date = 'Ingresá una fecha válida';
  else if (draft.date > today) errors.date = 'La fecha no puede ser futura';
  if (!draft.rangeId) errors.rangeId = 'Elegí el polígono';
  if (!draft.ammunitionId) errors.ammunitionId = 'Elegí la munición';
  if (draft.photos.length > MAX_SESSION_PHOTOS) {
    errors.photos = `Podés cargar hasta ${MAX_SESSION_PHOTOS} fotos`;
  }
  if (draft.notes.trim().length > NOTES_MAX_LENGTH) {
    errors.notes = `Las notas pueden tener hasta ${NOTES_MAX_LENGTH} caracteres`;
  }
  return errors;
}

/**
 * Documento a guardar a partir del borrador ya validado y las rutas de sus fotos ya subidas. Las
 * personalizaciones se guardan como copia (snapshot).
 */
export function sessionFields(draft: SessionDraft, photos: string[]): SessionFields {
  const { firearmId, configurationId } = parseFirearmOption(draft.firearm);
  return {
    date: draft.date,
    firearmId,
    configurationId,
    modificationsSnapshot: modificationSnapshot(draft.modifications),
    rangeId: draft.rangeId,
    weather: draft.weather,
    ammunitionId: draft.ammunitionId,
    photos,
    notes: draft.notes.trim(),
  };
}

// --- Borrador local --------------------------------------------------------------------------

/** Clave de `localStorage` del borrador de M04 (por usuario y por sesión, o `nueva`). */
export function draftStorageKey(uid: string, sessionId?: string): string {
  return `rb-session-draft:${uid}:${sessionId ?? 'nueva'}`;
}

/** Las fotos todavía sin subir (`Blob`) no entran en `localStorage`: solo las ya guardadas. */
export function serializeDraft(draft: SessionDraft): string {
  return JSON.stringify({
    ...draft,
    photos: draft.photos.flatMap((photo) => (photo.status === 'stored' ? [photo.path] : [])),
  });
}

function isWeather(value: unknown): value is Weather {
  return WEATHER_OPTIONS.includes(value as Weather);
}

/** Lee un borrador guardado; `undefined` si no hay o está dañado. */
export function parseStoredDraft(stored: string | null): SessionDraft | undefined {
  if (!stored) return undefined;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(stored) as Record<string, unknown>;
  } catch {
    return undefined;
  }
  if (typeof data !== 'object' || data === null) return undefined;
  const modifications = Array.isArray(data.modifications)
    ? (data.modifications as unknown[]).flatMap((item) => {
        const { id, brand, model } = (item ?? {}) as Record<string, unknown>;
        return typeof brand === 'string' && typeof model === 'string'
          ? [{ id: typeof id === 'string' ? id : null, brand, model }]
          : [];
      })
    : [];
  return {
    firearm: text(data.firearm),
    modifications,
    date: text(data.date),
    rangeId: text(data.rangeId),
    weather: isWeather(data.weather) ? data.weather : null,
    ammunitionId: text(data.ammunitionId),
    photos: storedPhotos(strings(data.photos)),
    notes: text(data.notes),
  };
}

// --- Totales ---------------------------------------------------------------------------------

/** Puntaje de una ronda: el confirmado del análisis o, si no hay, el cargado a mano. */
export function roundScore(round: Pick<Round, 'score' | 'manualScore'>): number | null {
  return round.score ?? round.manualScore;
}

export interface SessionTotals {
  rounds: number;
  shots: number;
  /** Suma de los puntajes de las rondas con puntaje; `null` si ninguna tiene. */
  score: number | null;
  /**
   * Máximo posible de esas rondas (disparos × zona más alta del blanco). `null` si alguna usa un
   * blanco sin zonas (no tiene máximo).
   */
  maxScore: number | null;
  /** Puntaje por tiro de las rondas con puntaje. */
  averagePerShot: number | null;
  /** Promedio del tamaño de grupo de las rondas analizadas. */
  groupSizeMm: number | null;
}

function maxZoneScore(target: Target | undefined): number | null {
  if (!target || target.scoring !== 'rings' || target.zones.length === 0) return null;
  return Math.max(...target.zones.map((zone) => zone.score));
}

export function sessionTotals(
  session: Pick<Session, 'rounds'>,
  targets: readonly Target[] = [],
): SessionTotals {
  const byId = new Map(targets.map((target) => [target.id, target]));
  let shots = 0;
  let score: number | null = null;
  let scoredShots = 0;
  let maxScore: number | null = 0;
  const groups: number[] = [];

  for (const round of session.rounds) {
    shots += round.shots;
    const value = roundScore(round);
    if (value !== null) {
      score = (score ?? 0) + value;
      scoredShots += round.shots;
      const zoneMax = maxZoneScore(byId.get(round.targetId));
      maxScore = maxScore === null || zoneMax === null ? null : maxScore + zoneMax * round.shots;
    }
    if (round.analysis?.groupSizeMm != null) groups.push(round.analysis.groupSizeMm);
  }

  return {
    rounds: session.rounds.length,
    shots,
    score,
    maxScore: score === null ? null : maxScore,
    averagePerShot: score !== null && scoredShots > 0 ? score / scoredShots : null,
    groupSizeMm: groups.length > 0 ? groups.reduce((a, b) => a + b, 0) / groups.length : null,
  };
}

export interface MonthSummary {
  sessions: number;
  shots: number;
  averagePerShot: number | null;
}

/** Resumen de M02: sesiones del mes de `today`, sus disparos y el promedio por tiro. */
export function monthSummary(sessions: readonly Session[], today: string): MonthSummary {
  const month = today.slice(0, 7);
  const own = sessions.filter((session) => session.date.startsWith(month));
  let shots = 0;
  let score = 0;
  let scoredShots = 0;
  for (const session of own) {
    for (const round of session.rounds) {
      shots += round.shots;
      const value = roundScore(round);
      if (value !== null) {
        score += value;
        scoredShots += round.shots;
      }
    }
  }
  return {
    sessions: own.length,
    shots,
    averagePerShot: scoredShots > 0 ? score / scoredShots : null,
  };
}

// --- Lista M02 -------------------------------------------------------------------------------

export interface MonthGroup<T> {
  /** `AAAA-MM`. */
  month: string;
  sessions: T[];
}

/** Agrupa por mes, de la más reciente a la más vieja. */
export function groupByMonth<T extends Pick<Session, 'id' | 'date'>>(
  sessions: readonly T[],
): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  for (const session of sortSessions(sessions)) {
    const month = session.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last?.month === month) last.sessions.push(session);
    else groups.push({ month, sessions: [session] });
  }
  return groups;
}

/** Nombres que se muestran (y se buscan) de una sesión. */
export interface SessionLabels {
  title: string;
  range: string;
  ammunition: string;
}

export interface SessionLookups {
  firearms: readonly Firearm[];
  configurations: readonly Configuration[];
  ranges: readonly Range[];
  ammunition: readonly Ammunition[];
}

export function sessionLabels(session: SessionFields, lookups: SessionLookups): SessionLabels {
  const firearm = lookups.firearms.find((item) => item.id === session.firearmId);
  const configuration = session.configurationId
    ? lookups.configurations.find((item) => item.id === session.configurationId)
    : null;
  const range = lookups.ranges.find((item) => item.id === session.rangeId);
  const ammunition = lookups.ammunition.find((item) => item.id === session.ammunitionId);
  return {
    title: sessionTitle(firearm, configuration),
    range: range?.name ?? '—',
    ammunition: ammunition ? ammunitionName(ammunition) : '—',
  };
}

export interface SessionFilter {
  /** Por arma, armas, polígono, munición, personalizaciones o notas. */
  query: string;
  /** Arma base; vacío = todas. */
  firearmId: string;
}

export function filterSessions(
  sessions: readonly Session[],
  { query, firearmId }: SessionFilter,
  lookups: SessionLookups,
): Session[] {
  return sessions.filter((session) => {
    if (firearmId && session.firearmId !== firearmId) return false;
    if (!query.trim()) return true;
    const labels = sessionLabels(session, lookups);
    return matchesSearch(
      [
        labels.title,
        labels.range,
        labels.ammunition,
        session.notes,
        ...session.modificationsSnapshot.map(modificationName),
      ],
      query,
    );
  });
}

/** Armas que aparecen en alguna sesión (chips del filtro), por nombre. */
export function sessionFirearms(
  sessions: readonly Session[],
  firearms: readonly Firearm[],
): Firearm[] {
  const used = new Set(sessions.map((session) => session.firearmId));
  return sortByName(
    firearms.filter((firearm) => used.has(firearm.id)),
    firearmName,
  );
}

/** Rutas en Storage de la sesión y de sus rondas: se borran al eliminarla. */
export function sessionPhotoPaths(session: Pick<Session, 'photos' | 'rounds'>): string[] {
  return [
    ...session.photos,
    ...session.rounds.flatMap((round) => (round.photo ? [round.photo] : [])),
  ];
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

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseRound(value: unknown, index: number): Round {
  const data = (value ?? {}) as Record<string, unknown>;
  const analysis = (data.analysis ?? null) as Record<string, unknown> | null;
  const metrics = (analysis?.metrics ?? null) as Record<string, unknown> | null;
  return {
    id: typeof data.id === 'string' ? data.id : `ronda-${index + 1}`,
    targetId: text(data.targetId),
    distanceM: numberOrNull(data.distanceM) ?? 0,
    shots: count(data.shots),
    manualScore: numberOrNull(data.manualScore),
    score: numberOrNull(data.score),
    photo: typeof data.photo === 'string' ? data.photo : null,
    comments: text(data.comments),
    analysis:
      analysis && typeof analysis === 'object'
        ? { groupSizeMm: numberOrNull(metrics?.groupSizeMm) }
        : null,
  };
}

export function parseSession(id: string, data: Record<string, unknown>): Session {
  return {
    id,
    date: text(data.date),
    firearmId: text(data.firearmId),
    configurationId: typeof data.configurationId === 'string' ? data.configurationId : null,
    modificationsSnapshot: Array.isArray(data.modificationsSnapshot)
      ? (data.modificationsSnapshot as unknown[]).flatMap((item) => {
          const { brand, model } = (item ?? {}) as Record<string, unknown>;
          return typeof brand === 'string' && typeof model === 'string' ? [{ brand, model }] : [];
        })
      : [],
    rangeId: text(data.rangeId),
    weather: isWeather(data.weather) ? data.weather : null,
    ammunitionId: text(data.ammunitionId),
    photos: strings(data.photos),
    notes: text(data.notes),
    rounds: Array.isArray(data.rounds) ? (data.rounds as unknown[]).map(parseRound) : [],
  };
}
