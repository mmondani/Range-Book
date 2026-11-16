import type { Firearm } from './firearms';
import {
  formatFixed,
  formatNumericDayMonth,
  formatTime,
  formatWeekdayDayMonth,
  isoDate,
} from './format';
import { MAX_MANTIS_SHOTS, type RoundMantis } from './mantis';
import { mantisStats } from './mantis-trace';
import { sortSessions, type Round, type Session } from './sessions';

/** Por qué una sesión de MantisX no se puede importar. */
export type MantisSkipReason =
  /** No hay ninguna sesión de Range Book ese día (`date`, `AAAA-MM-DD` local). */
  | { kind: 'no-session'; date: string }
  /** La sesión de ese día no tiene más rondas sin datos de MantisX. */
  | { kind: 'no-round'; sessionId: string }
  | { kind: 'too-many-shots' };

/** Sesión de MantisX que ya está en una ronda. */
export interface MantisImported {
  pk: number;
  sessionId: string;
  roundId: string;
  /** Desde 1, en el orden de la sesión. */
  roundNumber: number;
}

/** Sesiones de MantisX propuestas para una sesión de Range Book, en orden de hora. */
export interface MantisMatchGroup {
  sessionId: string;
  pks: number[];
}

export interface MantisMatching {
  /** De la sesión de Range Book más reciente a la más vieja. */
  groups: MantisMatchGroup[];
  /** Ronda elegida para cada sesión de MantisX de los grupos (`null` = no importar). */
  assignments: Record<number, string | null>;
  skipped: { pk: number; reason: MantisSkipReason }[];
  imported: MantisImported[];
}

/** Fecha local (`AAAA-MM-DD`) de la sesión de MantisX. */
export function mantisLocalDate(summary: Pick<RoundMantis, 'date'>): string {
  return isoDate(new Date(summary.date));
}

const normalize = (value: string) => value.toLocaleLowerCase('es-AR').replace(/[^a-z0-9]/g, '');
const digits = (value: string): string[] => value.match(/\d+/g) ?? [];

/** Qué tanto se parece el arma de la sesión a la de MantisX (marca y números del modelo). */
function firearmAffinity(firearm: Firearm | undefined, summary: RoundMantis): number {
  if (!firearm) return 0;
  let score = 0;
  const make = normalize(summary.firearm.make);
  if (make && normalize(firearm.brand) === make) score += 2;
  const model = digits(summary.firearm.model);
  if (digits(firearm.model).some((part) => model.includes(part))) score += 1;
  return score;
}

/** Minutos entre la hora de creación de la ronda y la sesión de MantisX (0 sin hora). */
function timeCost(round: Round, summary: RoundMantis): number {
  if (!round.createdAt) return 0;
  return Math.abs(Date.parse(round.createdAt) - Date.parse(summary.date)) / 60_000;
}

/**
 * Asigna sesiones de MantisX (en orden de hora) a rondas (en orden de la sesión) uno a uno y sin
 * cruzarse: primero la mayor cantidad posible y, entre esas, la menor diferencia de hora. Las
 * rondas sin hora no suman diferencia, así que se asignan por orden.
 */
function align(summaries: readonly RoundMantis[], rounds: readonly Round[]): (Round | null)[] {
  const m = summaries.length;
  const n = rounds.length;
  type Cell = { count: number; cost: number };
  const better = (a: Cell, b: Cell) =>
    a.count !== b.count ? a.count > b.count : a.cost < b.cost - 1e-9;
  const same = (a: Cell, b: Cell) => a.count === b.count && Math.abs(a.cost - b.cost) <= 1e-9;
  const dp: Cell[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => ({ count: 0, cost: 0 })),
  );
  const match = (i: number, j: number): Cell => ({
    count: dp[i - 1]![j - 1]!.count + 1,
    cost: dp[i - 1]![j - 1]!.cost + timeCost(rounds[j - 1]!, summaries[i - 1]!),
  });
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      let best = dp[i - 1]![j]!;
      if (better(dp[i]![j - 1]!, best)) best = dp[i]![j - 1]!;
      const matched = match(i, j);
      if (better(matched, best)) best = matched;
      dp[i]![j] = best;
    }
  }
  // De atrás hacia adelante; ante un empate quedan sin usar las últimas rondas y las últimas
  // sesiones de MantisX, así lo que no tiene hora se asigna por orden.
  const result: (Round | null)[] = Array.from({ length: m }, () => null);
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    const cell = dp[i]![j]!;
    if (same(dp[i]![j - 1]!, cell)) j -= 1;
    else if (same(dp[i - 1]![j]!, cell)) i -= 1;
    else {
      result[i - 1] = rounds[j - 1]!;
      i -= 1;
      j -= 1;
    }
  }
  return result;
}

/** Sesiones de MantisX que ya están en alguna ronda, por su id. */
function importedSessions(sessions: readonly Session[]): Map<number, MantisImported> {
  const imported = new Map<number, MantisImported>();
  for (const session of sessions) {
    session.rounds.forEach((round, index) => {
      if (round.mantis) {
        imported.set(round.mantis.sessionPk, {
          pk: round.mantis.sessionPk,
          sessionId: session.id,
          roundId: round.id,
          roundNumber: index + 1,
        });
      }
    });
  }
  return imported;
}

/**
 * Propone a qué ronda va cada sesión de MantisX: la sesión de Range Book del mismo día (si hay
 * varias, la del arma que más se parece) y, dentro de ella, las rondas sin datos de MantisX por
 * orden y por hora. Marca las ya importadas y las que no se pueden importar, con el motivo.
 */
export function proposeMatching(
  summaries: readonly RoundMantis[],
  sessions: readonly Session[],
  firearms: readonly Firearm[],
): MantisMatching {
  const already = importedSessions(sessions);
  const firearmById = new Map(firearms.map((firearm) => [firearm.id, firearm]));
  const ordered = sortSessions(sessions);
  const imported: MantisImported[] = [];
  const skipped: MantisMatching['skipped'] = [];
  const bySession = new Map<string, RoundMantis[]>();

  const pending = [...summaries].sort((a, b) => a.date.localeCompare(b.date));
  for (const summary of pending) {
    const done = already.get(summary.sessionPk);
    if (done) {
      imported.push(done);
      continue;
    }
    if (summary.shots.length > MAX_MANTIS_SHOTS) {
      skipped.push({ pk: summary.sessionPk, reason: { kind: 'too-many-shots' } });
      continue;
    }
    const date = mantisLocalDate(summary);
    const candidates = ordered.filter((session) => session.date === date);
    if (candidates.length === 0) {
      skipped.push({ pk: summary.sessionPk, reason: { kind: 'no-session', date } });
      continue;
    }
    let chosen = candidates[0]!;
    let affinity = firearmAffinity(firearmById.get(chosen.firearmId), summary);
    for (const candidate of candidates.slice(1)) {
      const value = firearmAffinity(firearmById.get(candidate.firearmId), summary);
      if (value > affinity) {
        chosen = candidate;
        affinity = value;
      }
    }
    bySession.set(chosen.id, [...(bySession.get(chosen.id) ?? []), summary]);
  }

  const groups: MantisMatchGroup[] = [];
  const assignments: Record<number, string | null> = {};
  for (const session of ordered) {
    const group = bySession.get(session.id);
    if (!group) continue;
    const available = session.rounds.filter((round) => !round.mantis);
    const rounds = align(group, available);
    const pks: number[] = [];
    group.forEach((summary, index) => {
      const round = rounds[index];
      if (round) {
        pks.push(summary.sessionPk);
        assignments[summary.sessionPk] = round.id;
      } else {
        skipped.push({
          pk: summary.sessionPk,
          reason: { kind: 'no-round', sessionId: session.id },
        });
      }
    });
    if (pks.length > 0) groups.push({ sessionId: session.id, pks });
  }
  // "No se importan" en orden de hora, como el archivo.
  const order = new Map(pending.map((summary, index) => [summary.sessionPk, index]));
  skipped.sort((a, b) => (order.get(a.pk) ?? 0) - (order.get(b.pk) ?? 0));
  return { groups, assignments, skipped, imported };
}

/**
 * Cambia la ronda de una sesión de MantisX (`null` = no importar). Si otra sesión de MantisX
 * tenía esa ronda, queda sin importar: una ronda recibe una sola.
 */
export function assignRound(
  matching: MantisMatching,
  pk: number,
  roundId: string | null,
): MantisMatching {
  if (!(pk in matching.assignments)) return matching;
  const assignments = { ...matching.assignments };
  if (roundId !== null) {
    for (const [other, value] of Object.entries(assignments)) {
      if (value === roundId && Number(other) !== pk) assignments[Number(other)] = null;
    }
  }
  assignments[pk] = roundId;
  return { ...matching, assignments };
}

/**
 * Rondas que se pueden elegir para una sesión de MantisX: las de su sesión sin datos de MantisX
 * que no eligió otra fila del grupo (más la que ya tiene).
 */
export function roundChoices(
  matching: MantisMatching,
  session: Pick<Session, 'rounds'>,
  pk: number,
): { round: Round; number: number }[] {
  const group = matching.groups.find((item) => item.pks.includes(pk));
  const taken = new Set(
    (group?.pks ?? [])
      .filter((other) => other !== pk)
      .map((other) => matching.assignments[other])
      .filter((value): value is string => typeof value === 'string'),
  );
  return session.rounds.flatMap((round, index) =>
    !round.mantis && !taken.has(round.id) ? [{ round, number: index + 1 }] : [],
  );
}

/** Lo que se va a importar: cada sesión de MantisX con su ronda. */
export function matchedImports(
  matching: MantisMatching,
): { sessionId: string; roundId: string; pk: number }[] {
  return matching.groups.flatMap((group) =>
    group.pks.flatMap((pk) => {
      const roundId = matching.assignments[pk];
      return roundId ? [{ sessionId: group.sessionId, roundId, pk }] : [];
    }),
  );
}

/** Aviso si los disparos de la ronda no coinciden con los de MantisX (no impide importar). */
export function shotsMismatch(
  round: Pick<Round, 'shots'>,
  number: number,
  summary: Pick<RoundMantis, 'shots'>,
): string | undefined {
  const mantis = summary.shots.length;
  if (round.shots === mantis) return undefined;
  const plural = (count: number) => (count === 1 ? '1 disparo' : `${count} disparos`);
  return `La ronda ${number} tiene ${plural(round.shots)} y MantisX registró ${mantis}.`;
}

// --- Textos de la revisión -------------------------------------------------------------------

const shotCount = (count: number) => (count === 1 ? '1 disparo' : `${count} disparos`);

/** `5 disparos · 93,9` (puntaje promedio de MantisX). */
export function mantisShotsLabel(summary: Pick<RoundMantis, 'shots'>): string {
  return `${shotCount(summary.shots.length)} · ${formatFixed(mantisStats(summary.shots).averageScore, 1)}`;
}

/** `Dom 15 nov · 10:25 · 4 disparos · 91,4`. */
export function mantisSessionLabel(summary: RoundMantis): string {
  const date = formatWeekdayDayMonth(mantisLocalDate(summary));
  return `${date} · ${formatTime(summary.date)} · ${mantisShotsLabel(summary)}`;
}

/** Opción del select: `Ronda 1 · 10:08 · 5 disparos` (sin hora en las rondas viejas). */
export function roundOptionLabel(round: Pick<Round, 'createdAt' | 'shots'>, number: number) {
  const time = round.createdAt ? ` · ${formatTime(round.createdAt)}` : '';
  return `Ronda ${number}${time} · ${shotCount(round.shots)}`;
}

export function skipReasonText(reason: MantisSkipReason): string {
  switch (reason.kind) {
    case 'no-session':
      return `No hay ninguna sesión de Range Book el ${formatNumericDayMonth(reason.date)}.`;
    case 'no-round':
      return 'No queda ninguna ronda disponible en esa sesión.';
    case 'too-many-shots':
      return `Tiene más de ${MAX_MANTIS_SHOTS} disparos.`;
  }
}

/** `En la ronda 1 de la sesión del 25/10.` */
export function importedText(imported: MantisImported, sessions: readonly Session[]): string {
  const session = sessions.find((item) => item.id === imported.sessionId);
  const date = session ? ` del ${formatNumericDayMonth(session.date)}` : '';
  return `En la ronda ${imported.roundNumber} de la sesión${date}.`;
}

/** Nota de las sesiones de otros entrenamientos, o `undefined` si no hubo. */
export function omittedNote(omitted: { count: number; trainings: readonly string[] }) {
  if (omitted.count === 0) return undefined;
  const names =
    omitted.trainings.length > 1
      ? `${omitted.trainings.slice(0, -1).join(', ')} y ${omitted.trainings.at(-1)}`
      : (omitted.trainings[0] ?? '');
  const what =
    omitted.count === 1
      ? 'Se omitió 1 sesión de otro entrenamiento'
      : `Se omitieron ${omitted.count} sesiones de otros entrenamientos`;
  return `${what} (${names}): por ahora solo se importa fuego real de «Open Training».`;
}
