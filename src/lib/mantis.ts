/**
 * Modelo de los datos de MantisX que se guardan en Range Book: el resumen de cada sesión de MantisX
 * (embebido en su ronda) y su trayectoria (en `mantisTraces`, aparte). Ver la iteración 003.
 */

/** Disparos de una sesión de MantisX que entran en una ronda (también lo exigen las reglas). */
export const MAX_MANTIS_SHOTS = 150;
/** Muestras por eje y por disparo de la trayectoria (unas 300 a 400 por segundo). */
export const MAX_TRACE_SAMPLES = 2000;

/** Un disparo, sin su trayectoria. */
export interface MantisShot {
  /** Id del disparo en MantisX. */
  pk: number;
  /** 0–100: calidad de la presión del gatillo, no la precisión en el blanco. */
  score: number;
  /** Segundos desde el disparo anterior (`0` en el primero). */
  split: number;
  /** Diagnóstico en inglés, tal cual lo da MantisX (`GREAT SHOT` = sin problema). */
  problem: string;
  /** Dirección del desvío, en grados: 0° = derecha, 90° = arriba (antihorario). */
  angle: number;
  /** Índice de movimiento durante el apuntado ("Mov. apuntando"), sin unidad. */
  triggerHold: number;
  /** Índice de movimiento durante la presión del gatillo ("Mov. disparando"), sin unidad. */
  triggerPull: number;
  /** Inclinación lateral del arma al disparar (cant), en grados; `null` si no vino. */
  cant: number | null;
}

/** Resumen de una sesión de MantisX, embebido en la ronda (`rounds[i].mantis`). */
export interface RoundMantis {
  /** Id de la sesión en MantisX: también es el id de su trayectoria. */
  sessionPk: number;
  /** ISO 8601 en UTC. */
  date: string;
  /** Modelo del sensor (`X10`). */
  hardware: string;
  rightHanded: boolean;
  firearm: { make: string; model: string; caliber: string };
  /** Distancia configurada en MantisX (`metric: false` = yardas); `null` si no vino. */
  distance: { value: number; metric: boolean } | null;
  shots: MantisShot[];
}

/** Trayectoria de un disparo: ángulos del arma, en grados, a `sampleRate` muestras por segundo. */
export interface MantisShotTrace {
  pk: number;
  pitch: number[];
  yaw: number[];
  /** Inicio del apuntado, de la presión del gatillo y el disparo (después viene el seguimiento). */
  holdIndex: number;
  pullIndex: number;
  shotIndex: number;
  /** Ángulo vertical absoluto al disparar, en grados; `null` si no vino. */
  absolutePitch: number | null;
}

/** Documento `users/{uid}/mantisTraces/{sessionPk}`. */
export interface MantisTrace {
  sampleRate: number;
  shots: MantisShotTrace[];
}

/** Trayectoria de un disparo (por su id), si está en el documento. */
export function findShotTrace(trace: MantisTrace, pk: number): MantisShotTrace | undefined {
  return trace.shots.find((shot) => shot.pk === pk);
}

// --- Lectura de Firestore --------------------------------------------------------------------

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const text = (value: unknown) => (typeof value === 'string' ? value : '');

const numberOrNull = (value: unknown) => (isNumber(value) ? value : null);

function parseShot(value: unknown): MantisShot | undefined {
  const data = (value ?? {}) as Record<string, unknown>;
  if (!isNumber(data.pk) || !isNumber(data.score) || !isNumber(data.split)) return undefined;
  return {
    pk: data.pk,
    score: data.score,
    split: data.split,
    problem: text(data.problem),
    angle: numberOrNull(data.angle) ?? 0,
    triggerHold: numberOrNull(data.triggerHold) ?? 0,
    triggerPull: numberOrNull(data.triggerPull) ?? 0,
    cant: numberOrNull(data.cant),
  };
}

/** Resumen guardado en la ronda; `null` si no hay o está dañado. */
export function parseRoundMantis(value: unknown): RoundMantis | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (!isNumber(data.sessionPk) || typeof data.date !== 'string') return null;
  const shots = Array.isArray(data.shots)
    ? (data.shots as unknown[]).flatMap((shot) => parseShot(shot) ?? [])
    : [];
  if (shots.length === 0) return null;
  const firearm = (data.firearm ?? {}) as Record<string, unknown>;
  const distance = (data.distance ?? null) as Record<string, unknown> | null;
  return {
    sessionPk: data.sessionPk,
    date: data.date,
    hardware: text(data.hardware),
    rightHanded: data.rightHanded !== false,
    firearm: {
      make: text(firearm.make),
      model: text(firearm.model),
      caliber: text(firearm.caliber),
    },
    distance:
      distance && isNumber(distance.value)
        ? { value: distance.value, metric: distance.metric !== false }
        : null,
    shots,
  };
}

const numbers = (value: unknown): number[] | undefined =>
  Array.isArray(value) && value.every(isNumber) ? (value as number[]) : undefined;

function parseShotTrace(value: unknown): MantisShotTrace | undefined {
  const data = (value ?? {}) as Record<string, unknown>;
  const pitch = numbers(data.pitch);
  const yaw = numbers(data.yaw);
  if (!isNumber(data.pk) || !pitch || !yaw || pitch.length !== yaw.length) return undefined;
  const last = pitch.length - 1;
  const index = (item: unknown, fallback: number) =>
    isNumber(item) && Number.isInteger(item) && item >= 0 && item <= last ? item : fallback;
  const shotIndex = index(data.shotIndex, last);
  const holdIndex = Math.min(index(data.holdIndex, 0), shotIndex);
  const pullIndex = Math.min(Math.max(index(data.pullIndex, holdIndex), holdIndex), shotIndex);
  return {
    pk: data.pk,
    pitch,
    yaw,
    holdIndex,
    pullIndex,
    shotIndex,
    absolutePitch: numberOrNull(data.absolutePitch),
  };
}

/** Documento de `mantisTraces`; `null` si está dañado. */
export function parseMantisTrace(data: Record<string, unknown> | undefined): MantisTrace | null {
  if (!data || !isNumber(data.sampleRate) || data.sampleRate <= 0) return null;
  const shots = Array.isArray(data.shots)
    ? (data.shots as unknown[]).flatMap((shot) => parseShotTrace(shot) ?? [])
    : [];
  return { sampleRate: data.sampleRate, shots };
}
