import { formatDecimal, parseDecimal } from './format';
import { selectableItems, type FieldErrors } from './inventory';
import { storedPhotos, type PhotoDraft } from './photos';
import { roundScore, sortSessions, type Round, type Session } from './sessions';
import { maxZoneScore, targetName, type Target } from './targets';

/** Límites de una ronda (las reglas no recorren las rondas: los valida solo el cliente). */
export const MAX_ROUND_SHOTS = 999;
export const MAX_DISTANCE_M = 2000;
export const MAX_ROUND_SCORE = 100_000;
export const COMMENTS_MAX_LENGTH = 500;
/** Disparos de la primera ronda, si no hay ninguna anterior. */
export const DEFAULT_SHOTS = 10;

/** Campos de la ronda que se editan en M05 (el análisis se edita en M06). */
export type RoundFields = Pick<
  Round,
  'targetId' | 'distanceM' | 'shots' | 'manualScore' | 'photo' | 'comments'
>;

/** Borrador del formulario M05, con los números como se escriben. */
export interface RoundDraft {
  targetId: string;
  distance: string;
  shots: number;
  manualScore: string;
  /** Cero o una foto. */
  photos: PhotoDraft[];
  comments: string;
}

// --- Defaults --------------------------------------------------------------------------------

/**
 * Rondas anteriores, de la más reciente a la más vieja: primero las de esta sesión y después las
 * de las otras sesiones (de la más nueva a la más vieja).
 */
function previousRounds(session: Session, sessions: readonly Session[]): Round[] {
  const others = sortSessions(sessions.filter((item) => item.id !== session.id));
  return [session, ...others].flatMap((item) => [...item.rounds].reverse());
}

/**
 * Ronda nueva: la distancia y los disparos de la ronda anterior, y el último blanco usado que
 * siga activo.
 */
export function newRoundDraft(
  session: Session,
  sessions: readonly Session[],
  targets: readonly Target[],
): RoundDraft {
  const previous = previousRounds(session, sessions);
  const active = new Set(targets.filter((target) => !target.archived).map((target) => target.id));
  const last = previous[0];
  return {
    targetId: previous.find((round) => active.has(round.targetId))?.targetId ?? '',
    distance: last ? formatDecimal(last.distanceM) : '',
    shots: last?.shots || DEFAULT_SHOTS,
    manualScore: '',
    photos: [],
    comments: '',
  };
}

export function roundDraft(round: Round): RoundDraft {
  return {
    targetId: round.targetId,
    distance: formatDecimal(round.distanceM),
    shots: round.shots,
    manualScore: round.manualScore === null ? '' : String(round.manualScore),
    photos: round.photo ? storedPhotos([round.photo]) : [],
    comments: round.comments,
  };
}

/** Blancos del select: los activos y el ya elegido. */
export function roundTargets(targets: readonly Target[], selectedId: string): Target[] {
  return selectableItems(targets, targetName, selectedId);
}

// --- Validación ------------------------------------------------------------------------------

function parseScore(value: string): number | undefined {
  const text = value.trim();
  return /^\d+$/.test(text) ? Number(text) : undefined;
}

/** Máximo puntaje posible de la ronda: disparos × zona más alta. `null` si el blanco no tiene zonas. */
export function roundMaxScore(target: Target | undefined, shots: number): number | null {
  const zone = maxZoneScore(target);
  return zone === null ? null : zone * shots;
}

export function validateRound(
  draft: RoundDraft,
  targets: readonly Target[],
): FieldErrors<RoundDraft> {
  const errors: FieldErrors<RoundDraft> = {};
  const target = targets.find((item) => item.id === draft.targetId);
  if (!target) errors.targetId = 'Elegí el blanco';

  const distance = parseDecimal(draft.distance);
  if (!draft.distance.trim()) errors.distance = 'Ingresá la distancia';
  else if (distance === undefined || distance <= 0)
    errors.distance = 'Ingresá una distancia válida';
  else if (distance > MAX_DISTANCE_M) {
    errors.distance = `La distancia puede ser de hasta ${MAX_DISTANCE_M} m`;
  }

  if (!Number.isInteger(draft.shots) || draft.shots < 1 || draft.shots > MAX_ROUND_SHOTS) {
    errors.shots = `Ingresá entre 1 y ${MAX_ROUND_SHOTS} disparos`;
  }

  if (draft.manualScore.trim()) {
    const score = parseScore(draft.manualScore);
    const max = roundMaxScore(target, draft.shots) ?? MAX_ROUND_SCORE;
    if (score === undefined) errors.manualScore = 'Ingresá un número entero, sin decimales';
    else if (score > max) errors.manualScore = `El puntaje no puede superar el máximo (${max})`;
  }

  if (draft.photos.length > 1) errors.photos = 'La ronda tiene una sola foto';
  if (draft.comments.trim().length > COMMENTS_MAX_LENGTH) {
    errors.comments = `Los comentarios pueden tener hasta ${COMMENTS_MAX_LENGTH} caracteres`;
  }
  return errors;
}

/** Campos a guardar a partir del borrador ya validado y la ruta de su foto ya subida. */
export function roundFields(draft: RoundDraft, photo: string | null): RoundFields {
  return {
    targetId: draft.targetId,
    distanceM: parseDecimal(draft.distance) ?? 0,
    shots: draft.shots,
    manualScore: parseScore(draft.manualScore) ?? null,
    photo,
    comments: draft.comments.trim(),
  };
}

// --- Lista de M03 ----------------------------------------------------------------------------

/** Una ronda con lo que se muestra de ella. */
export interface RoundItem {
  round: Round;
  /** Desde 1, en el orden de la sesión. */
  number: number;
  /** Nombre del blanco, aunque esté archivado. */
  targetLabel: string;
  target: Target | undefined;
  score: number | null;
  analyzed: boolean;
}

export function roundItems(
  session: Pick<Session, 'rounds'>,
  targets: readonly Target[],
): RoundItem[] {
  const byId = new Map(targets.map((target) => [target.id, target]));
  return session.rounds.map((round, index) => {
    const target = byId.get(round.targetId);
    return {
      round,
      number: index + 1,
      targetLabel: target ? targetName(target) : 'Blanco desconocido',
      target,
      score: roundScore(round),
      analyzed: isAnalyzed(round),
    };
  });
}

// --- Análisis --------------------------------------------------------------------------------

export function isAnalyzed(round: Pick<Round, 'analysis'>): boolean {
  return round.analysis !== null;
}

/**
 * El análisis (y el puntaje calculado) se hizo sobre una foto y un blanco: si cambia alguno de
 * los dos, ya no vale y se descarta al guardar.
 */
export function discardsAnalysis(
  round: Pick<Round, 'analysis' | 'score' | 'photo' | 'targetId'> | undefined,
  draft: Pick<RoundDraft, 'photos' | 'targetId'>,
): boolean {
  if (!round || (round.analysis === null && round.score === null)) return false;
  const [photo] = draft.photos;
  const samePhoto = photo?.status === 'stored' && photo.path === round.photo;
  return !samePhoto || draft.targetId !== round.targetId;
}

// --- Documento en Firestore ------------------------------------------------------------------

/** Ronda tal como está guardada: se conservan los campos que la app no lee (el análisis completo). */
export type RawRound = Record<string, unknown>;

export function rawRounds(value: unknown): RawRound[] {
  return Array.isArray(value)
    ? value.map((round: unknown) => (round && typeof round === 'object' ? (round as RawRound) : {}))
    : [];
}

/**
 * Agrega la ronda al final o reemplaza sus campos de M05. Si `keepAnalysis` es `false`, borra el
 * análisis y el puntaje calculado.
 */
export function saveRawRound(
  rounds: readonly RawRound[],
  id: string,
  fields: RoundFields,
  keepAnalysis: boolean,
): RawRound[] {
  const reset = keepAnalysis ? {} : { score: null, analysis: null };
  const index = rounds.findIndex((round) => round.id === id);
  if (index === -1) return [...rounds, { id, ...fields, score: null, analysis: null }];
  return rounds.map((round, i) => (i === index ? { ...round, ...fields, ...reset } : round));
}

/** Saca la ronda y devuelve dónde estaba, para poder deshacerlo. */
export function removeRawRound(
  rounds: readonly RawRound[],
  id: string,
): { rounds: RawRound[]; removed?: { round: RawRound; index: number } } {
  const index = rounds.findIndex((round) => round.id === id);
  if (index === -1) return { rounds: [...rounds] };
  return {
    rounds: rounds.filter((_, i) => i !== index),
    removed: { round: rounds[index]!, index },
  };
}

/** Vuelve a poner una ronda eliminada en su lugar (si no se agregó otra con el mismo id). */
export function restoreRawRound(
  rounds: readonly RawRound[],
  removed: { round: RawRound; index: number },
): RawRound[] {
  if (rounds.some((round) => round.id === removed.round.id)) return [...rounds];
  const next = [...rounds];
  next.splice(Math.min(removed.index, next.length), 0, removed.round);
  return next;
}
