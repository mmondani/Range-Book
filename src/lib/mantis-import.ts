import type { MantisShot, MantisShotTrace, MantisTrace, RoundMantis } from './mantis';

/** Lo que escribe el marcador "Exportar a Range Book" (`mantis-bookmarklet.ts`). */
export const MANTIS_SOURCE = 'mantisx';
export const MANTIS_FORMAT_VERSION = 1;

/** Fuego real (`fire_type`) y "Open Training" (`drill_id`): lo único que se importa por ahora. */
const LIVE_FIRE = 1;
const OPEN_TRAINING = 0;
const DRY_FIRE_LABEL = 'tiro en seco';

export type MantisImportError = 'not-mantis' | 'newer-version' | 'unreadable' | 'no-sessions';

/** Textos del `Alert` de cada error. */
export const MANTIS_IMPORT_ERRORS: Record<MantisImportError, { title: string; text: string }> = {
  'not-mantis': {
    title: 'El archivo no es un export de MantisX',
    text: 'Exportalo de nuevo con el marcador y elegí el archivo mantisx-….json que se descargó.',
  },
  'newer-version': {
    title: 'Este archivo es de una versión más nueva del marcador: actualizá Range Book',
    text: 'Cerrá y volvé a abrir la app para que se actualice, y elegí el archivo de nuevo.',
  },
  unreadable: {
    title: 'No se pudo leer el archivo',
    text: 'Puede estar incompleto o dañado. Exportalo de nuevo con el marcador.',
  },
  'no-sessions': {
    title: 'El archivo no tiene sesiones de fuego real de «Open Training»',
    text: 'Por ahora solo se importan esas sesiones. Exportá otro rango de fechas.',
  },
};

/** Una sesión de MantisX lista para importar: el resumen (va en la ronda) y la trayectoria. */
export interface ImportedMantisSession {
  summary: RoundMantis;
  trace: MantisTrace;
}

export interface MantisFile {
  /** Sesiones de fuego real de "Open Training", de la más vieja a la más nueva. */
  sessions: ImportedMantisSession[];
  /** Sesiones de otros entrenamientos, que no se importan. */
  omitted: { count: number; trainings: string[] };
}

export type MantisFileResult =
  { ok: true; file: MantisFile } | { ok: false; error: MantisImportError };

/** El dato no tiene el formato esperado: el archivo no sirve. */
class InvalidData extends Error {}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** MantisX manda algunos números como texto (`"93.52"`). */
function toNumber(value: unknown): number {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) throw new InvalidData();
  return number;
}

function toIndex(value: unknown, length: number): number {
  const index = toNumber(value);
  if (!Number.isInteger(index) || index < 0 || index >= length) throw new InvalidData();
  return index;
}

function toNumbers(value: unknown): number[] {
  if (!Array.isArray(value)) throw new InvalidData();
  return value.map(toNumber);
}

const first = (value: unknown): number | null =>
  Array.isArray(value) && value.length > 0 ? toNumber(value[0]) : null;

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

function parseShot(data: Record<string, unknown>): { shot: MantisShot; trace: MantisShotTrace } {
  const pk = toNumber(data.pk);
  const pitch = toNumbers(data.pitch);
  const yaw = toNumbers(data.yaw);
  if (pitch.length === 0 || pitch.length !== yaw.length) throw new InvalidData();
  const holdIndex = toIndex(data.hold_index, pitch.length);
  const pullIndex = toIndex(data.pull_index, pitch.length);
  const shotIndex = toIndex(data.shot_index, pitch.length);
  if (holdIndex > pullIndex || pullIndex > shotIndex) throw new InvalidData();
  return {
    shot: {
      pk,
      score: toNumber(data.score),
      split: toNumber(data.split),
      problem: text(data.problem),
      angle: toNumber(data.angle),
      triggerHold: toNumber(data.trigger_hold),
      triggerPull: toNumber(data.trigger_pull),
      cant: first(data.absolute_roll),
    },
    trace: {
      pk,
      pitch,
      yaw,
      holdIndex,
      pullIndex,
      shotIndex,
      absolutePitch: first(data.absolute_pitch),
    },
  };
}

function parseSession(data: Record<string, unknown>): ImportedMantisSession | undefined {
  const date = new Date(text(data.date));
  if (Number.isNaN(date.getTime())) throw new InvalidData();
  if (!Array.isArray(data.shots)) throw new InvalidData();
  const shots = (data.shots as unknown[])
    .filter((shot) => !(isObject(shot) && shot.deleted === true))
    .map((shot) => {
      if (!isObject(shot)) throw new InvalidData();
      return { parsed: parseShot(shot), sampleRate: toNumber(shot.sample_rate) };
    });
  // Una sesión sin disparos (todos borrados) no tiene nada para importar.
  if (shots.length === 0) return undefined;
  const sampleRate = shots[0]!.sampleRate;
  if (sampleRate <= 0) throw new InvalidData();

  const extras = isObject(data.extras) ? data.extras : {};
  const firearm = isObject(data.firearm) ? data.firearm : {};
  const distance =
    extras.distance === undefined || extras.distance === null
      ? null
      : { value: toNumber(extras.distance), metric: extras.isDistanceMetric !== false };
  return {
    summary: {
      sessionPk: toNumber(data.pk),
      date: date.toISOString(),
      hardware: text(extras.hardware),
      rightHanded: data.right_handed !== false,
      firearm: {
        make: text(firearm.make),
        model: text(firearm.model),
        caliber: text(firearm.caliber),
      },
      distance: distance && distance.value > 0 ? distance : null,
      shots: shots.map(({ parsed }) => parsed.shot),
    },
    trace: { sampleRate, shots: shots.map(({ parsed }) => parsed.trace) },
  };
}

/** Nombre del entrenamiento omitido, para la nota de la revisión. */
function trainingName(data: Record<string, unknown>): string {
  if (data.fire_type !== LIVE_FIRE) return DRY_FIRE_LABEL;
  return text(data.drill_name) || 'otros entrenamientos';
}

/**
 * Lee el archivo exportado con el marcador: valida el formato, se queda con las sesiones de fuego
 * real de "Open Training" (sin las borradas ni sus disparos borrados) y pasa los números y las
 * fechas a su tipo. No importa `bullseye`, `session_pk` ni `extras.iteration`.
 */
export function parseMantisFile(content: string): MantisFileResult {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    return { ok: false, error: 'unreadable' };
  }
  if (!isObject(data) || data.source !== MANTIS_SOURCE) return { ok: false, error: 'not-mantis' };
  if (typeof data.formatVersion === 'number' && data.formatVersion > MANTIS_FORMAT_VERSION) {
    return { ok: false, error: 'newer-version' };
  }
  if (data.formatVersion !== MANTIS_FORMAT_VERSION || !Array.isArray(data.sessions)) {
    return { ok: false, error: 'not-mantis' };
  }

  const sessions: ImportedMantisSession[] = [];
  const trainings: string[] = [];
  let omitted = 0;
  try {
    for (const item of data.sessions as unknown[]) {
      if (!isObject(item)) throw new InvalidData();
      if (item.deleted === true) continue;
      if (item.fire_type !== LIVE_FIRE || item.drill_id !== OPEN_TRAINING) {
        omitted += 1;
        const name = trainingName(item);
        if (!trainings.includes(name)) trainings.push(name);
        continue;
      }
      const session = parseSession(item);
      if (session) sessions.push(session);
    }
  } catch (error) {
    if (error instanceof InvalidData) return { ok: false, error: 'unreadable' };
    throw error;
  }
  if (sessions.length === 0) return { ok: false, error: 'no-sessions' };

  sessions.sort((a, b) => a.summary.date.localeCompare(b.summary.date));
  return { ok: true, file: { sessions, omitted: { count: omitted, trainings } } };
}
