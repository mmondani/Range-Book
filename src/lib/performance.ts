import { formatDecimal, formatIsoDate } from './format';
import { ammunitionName, sortByName, type Ammunition, type Range } from './inventory';
import { clockHour, MM_PER_MOA_PER_M } from './metrics';
import {
  firearmOptionValue,
  roundScore,
  sessionLabels,
  sessionTitle,
  type Round,
  type Session,
  type SessionLookups,
} from './sessions';
import type { TargetPoint } from './target-zones';
import { targetName, type Target } from './targets';
import { fromMm, UNIT_DECIMALS, UNIT_SYMBOLS, type Units } from './units';

/**
 * Rendimiento (M07 / W05): filtros, KPIs con delta contra el período anterior, series por sesión,
 * comparación por munición, tabla ordenable y CSV. Se agregan las rondas que cumplen los filtros:
 * los de la sesión (configuración, munición, polígono, fecha) y los de la ronda (blanco, distancia).
 */

// --- Filtros ---------------------------------------------------------------------------------

export const PERIODS = ['30d', '90d', '365d', 'todo'] as const;

export type Period = (typeof PERIODS)[number];

export const DEFAULT_PERIOD: Period = '90d';

export const PERIOD_LABELS: Record<Period, string> = {
  '30d': 'Últimos 30 días',
  '90d': 'Últimos 90 días',
  '365d': 'Último año',
  todo: 'Todo',
};

const PERIOD_DAYS: Record<Period, number | null> = {
  '30d': 30,
  '90d': 90,
  '365d': 365,
  todo: null,
};

/** Valor de `distancia` en la query string para ver todas las distancias. */
export const ALL_DISTANCES = 'todas';

export interface PerformanceFilters {
  /** `firearmOptionValue` (`glock` es "Stock", `glock/ipsc` una configuración); vacío = todas. */
  configuration: string;
  ammunitionId: string;
  targetId: string;
  rangeId: string;
  /** Metros. `undefined` = la distancia más usada (por defecto); `null` = todas. */
  distanceM: number | null | undefined;
  period: Period;
}

/** Nombre de cada filtro en la query string. */
export const FILTER_PARAMS = {
  configuration: 'configuracion',
  ammunitionId: 'municion',
  targetId: 'blanco',
  rangeId: 'poligono',
  distanceM: 'distancia',
  period: 'periodo',
} as const satisfies Record<keyof PerformanceFilters, string>;

export type FilterKey = keyof typeof FILTER_PARAMS;

function parseDistanceParam(value: string | null): number | null | undefined {
  if (value === ALL_DISTANCES) return null;
  const distance = Number(value);
  return value && Number.isFinite(distance) && distance > 0 ? distance : undefined;
}

export function parseFilters(params: URLSearchParams): PerformanceFilters {
  const period = params.get(FILTER_PARAMS.period);
  return {
    configuration: params.get(FILTER_PARAMS.configuration) ?? '',
    ammunitionId: params.get(FILTER_PARAMS.ammunitionId) ?? '',
    targetId: params.get(FILTER_PARAMS.targetId) ?? '',
    rangeId: params.get(FILTER_PARAMS.rangeId) ?? '',
    distanceM: parseDistanceParam(params.get(FILTER_PARAMS.distanceM)),
    period: PERIODS.includes(period as Period) ? (period as Period) : DEFAULT_PERIOD,
  };
}

/** Valor de la distancia en la query string: vacío (la más usada), `todas` o los metros. */
export function distanceParam(distanceM: number | null | undefined): string {
  if (distanceM === undefined) return '';
  return distanceM === null ? ALL_DISTANCES : String(distanceM);
}

/** Si algún filtro no tiene su valor por defecto (para "Limpiar filtros"). */
export function hasActiveFilters(filters: PerformanceFilters): boolean {
  return (
    filters.configuration !== '' ||
    filters.ammunitionId !== '' ||
    filters.targetId !== '' ||
    filters.rangeId !== '' ||
    filters.distanceM !== undefined ||
    filters.period !== DEFAULT_PERIOD
  );
}

// --- Período ---------------------------------------------------------------------------------

/** Fechas `AAAA-MM-DD`, ambas incluidas. */
export interface DateRange {
  from: string;
  to: string;
}

function addDays(date: string, days: number): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Los últimos N días hasta `today` incluido; `null` en "Todo". */
export function periodRange(period: Period, today: string): DateRange | null {
  const days = PERIOD_DAYS[period];
  return days === null ? null : { from: addDays(today, 1 - days), to: today };
}

/** Los N días anteriores al período; `null` en "Todo" (no hay con qué comparar). */
export function previousPeriodRange(period: Period, today: string): DateRange | null {
  const current = periodRange(period, today);
  const days = PERIOD_DAYS[period];
  if (!current || days === null) return null;
  return { from: addDays(current.from, -days), to: addDays(current.from, -1) };
}

// --- Rondas filtradas ------------------------------------------------------------------------

/** Una ronda con su sesión. */
export interface PerformanceRound {
  session: Session;
  round: Round;
}

/** Rondas que cumplen los filtros, salvo la distancia (que se resuelve aparte) y el período. */
function matchingRounds(
  sessions: readonly Session[],
  filters: PerformanceFilters,
): PerformanceRound[] {
  return sessions.flatMap((session) => {
    if (
      filters.configuration &&
      firearmOptionValue(session.firearmId, session.configurationId) !== filters.configuration
    ) {
      return [];
    }
    if (filters.ammunitionId && session.ammunitionId !== filters.ammunitionId) return [];
    if (filters.rangeId && session.rangeId !== filters.rangeId) return [];
    return session.rounds
      .filter((round) => !filters.targetId || round.targetId === filters.targetId)
      .map((round) => ({ session, round }));
  });
}

function inRange(entry: PerformanceRound, range: DateRange | null): boolean {
  return !range || (entry.session.date >= range.from && entry.session.date <= range.to);
}

/**
 * La distancia con más rondas (a igual cantidad, la más corta); `null` si no hay rondas. Mezclar
 * distancias distorsiona el tamaño de grupo en mm, por eso es el filtro por defecto.
 */
export function mostUsedDistance(entries: readonly PerformanceRound[]): number | null {
  const counts = new Map<number, number>();
  for (const { round } of entries) {
    counts.set(round.distanceM, (counts.get(round.distanceM) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [distance, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== null && distance < best)) {
      best = distance;
      bestCount = count;
    }
  }
  return best;
}

// --- Agregación ------------------------------------------------------------------------------

/**
 * En qué se miden el grupo y el desvío del PMI: en mm (en la unidad del perfil) si todas las rondas
 * analizadas son a la misma distancia; si se mezclan distancias, en MOA, que sí se pueden comparar.
 */
export type Measure = 'length' | 'moa';

export interface PerformanceStats {
  sessions: number;
  rounds: number;
  shots: number;
  analyzedRounds: number;
  /** Puntaje por tiro de las rondas con puntaje (confirmado o manual). */
  averagePerShot: number | null;
  /** Promedio del tamaño de grupo de las rondas analizadas, en mm o MOA (según `Measure`). */
  groupSize: number | null;
  /** Distancia al centro del PMI de todos los impactos, en mm o MOA. */
  mpiOffset: number | null;
  /** Dirección de ese PMI en horas de reloj; `null` si está centrado. */
  mpiClock: number | null;
}

function measureScale(measure: Measure, distanceM: number): number | null {
  if (measure === 'length') return 1;
  return distanceM > 0 ? 1 / (distanceM * MM_PER_MOA_PER_M) : null;
}

export function performanceStats(
  entries: readonly PerformanceRound[],
  measure: Measure,
): PerformanceStats {
  const sessions = new Set<string>();
  let shots = 0;
  let score = 0;
  let scoredShots = 0;
  let analyzedRounds = 0;
  let groupSum = 0;
  let groups = 0;
  // PMI de todos los impactos: promedio de los PMI de cada ronda, pesado por sus impactos.
  let mpiSum: TargetPoint = { x: 0, y: 0 };
  let mpiImpacts = 0;

  for (const { session, round } of entries) {
    sessions.add(session.id);
    shots += round.shots;
    const value = roundScore(round);
    if (value !== null) {
      score += value;
      scoredShots += round.shots;
    }
    const metrics = round.analysis?.metrics;
    if (!metrics) continue;
    analyzedRounds += 1;
    const scale = measureScale(measure, round.distanceM);
    if (scale === null) continue;
    if (metrics.groupSizeMm !== null) {
      groupSum += metrics.groupSizeMm * scale;
      groups += 1;
    }
    if (metrics.mpi && metrics.impacts > 0) {
      mpiSum = {
        x: mpiSum.x + metrics.mpi.x * scale * metrics.impacts,
        y: mpiSum.y + metrics.mpi.y * scale * metrics.impacts,
      };
      mpiImpacts += metrics.impacts;
    }
  }

  const mpi = mpiImpacts > 0 ? { x: mpiSum.x / mpiImpacts, y: mpiSum.y / mpiImpacts } : null;
  return {
    sessions: sessions.size,
    rounds: entries.length,
    shots,
    analyzedRounds,
    averagePerShot: scoredShots > 0 ? score / scoredShots : null,
    groupSize: groups > 0 ? groupSum / groups : null,
    mpiOffset: mpi && Math.hypot(mpi.x, mpi.y),
    mpiClock: mpi && clockHour(mpi),
  };
}

export interface PerformanceDeltas {
  averagePerShot: number | null;
  groupSize: number | null;
  mpiOffset: number | null;
  shots: number | null;
}

const difference = (current: number | null, previous: number | null) =>
  current === null || previous === null ? null : current - previous;

/** Diferencia contra el período anterior; `null` si falta alguno de los dos valores. */
export function performanceDeltas(
  current: PerformanceStats,
  previous: PerformanceStats | null,
): PerformanceDeltas {
  if (!previous || previous.rounds === 0) {
    return { averagePerShot: null, groupSize: null, mpiOffset: null, shots: null };
  }
  return {
    averagePerShot: difference(current.averagePerShot, previous.averagePerShot),
    groupSize: difference(current.groupSize, previous.groupSize),
    mpiOffset: difference(current.mpiOffset, previous.mpiOffset),
    shots: current.shots - previous.shots,
  };
}

// --- Reporte ---------------------------------------------------------------------------------

/** Una fila de la tabla y un punto de los gráficos: las rondas filtradas de una sesión. */
export interface SessionPerformance {
  session: Session;
  /** Distancias de esas rondas, de menor a mayor. */
  distances: number[];
  stats: PerformanceStats;
}

export interface AmmunitionPerformance {
  ammunitionId: string;
  stats: PerformanceStats;
}

export interface PerformanceReport {
  /** Distancia aplicada: la elegida o la más usada; `null` = todas. */
  distanceM: number | null;
  measure: Measure;
  current: PerformanceStats;
  previous: PerformanceStats | null;
  deltas: PerformanceDeltas;
  /** De la más vieja a la más reciente. */
  sessions: SessionPerformance[];
  /** De mejor a peor promedio por tiro (las que no tienen puntaje, al final). */
  byAmmunition: AmmunitionPerformance[];
}

function groupBy<K>(
  entries: readonly PerformanceRound[],
  key: (entry: PerformanceRound) => K,
): Map<K, PerformanceRound[]> {
  const groups = new Map<K, PerformanceRound[]>();
  for (const entry of entries) {
    const value = key(entry);
    const group = groups.get(value);
    if (group) group.push(entry);
    else groups.set(value, [entry]);
  }
  return groups;
}

export function performanceReport(
  sessions: readonly Session[],
  filters: PerformanceFilters,
  today: string,
): PerformanceReport {
  const currentRange = periodRange(filters.period, today);
  const previousRange = previousPeriodRange(filters.period, today);
  const matching = matchingRounds(sessions, filters);
  const inPeriod = matching.filter((entry) => inRange(entry, currentRange));

  const distanceM =
    filters.distanceM === undefined ? mostUsedDistance(inPeriod) : filters.distanceM;
  const byDistance = (entry: PerformanceRound) =>
    distanceM === null || entry.round.distanceM === distanceM;
  const current = inPeriod.filter(byDistance);
  const previous = previousRange
    ? matching.filter((entry) => inRange(entry, previousRange) && byDistance(entry))
    : null;

  const analyzedDistances = new Set(
    [...current, ...(previous ?? [])]
      .filter(({ round }) => round.analysis)
      .map(({ round }) => round.distanceM),
  );
  const measure: Measure = analyzedDistances.size > 1 ? 'moa' : 'length';

  const currentStats = performanceStats(current, measure);
  const previousStats = previous && performanceStats(previous, measure);

  const bySession = [...groupBy(current, (entry) => entry.session).entries()]
    .map(([session, entries]) => ({
      session,
      distances: [...new Set(entries.map(({ round }) => round.distanceM))].sort((a, b) => a - b),
      stats: performanceStats(entries, measure),
    }))
    .sort(
      (a, b) =>
        a.session.date.localeCompare(b.session.date) || a.session.id.localeCompare(b.session.id),
    );

  const byAmmunition = [...groupBy(current, (entry) => entry.session.ammunitionId).entries()]
    .map(([ammunitionId, entries]) => ({
      ammunitionId,
      stats: performanceStats(entries, measure),
    }))
    .sort((a, b) => (b.stats.averagePerShot ?? -Infinity) - (a.stats.averagePerShot ?? -Infinity));

  return {
    distanceM,
    measure,
    current: currentStats,
    previous: previousStats,
    deltas: performanceDeltas(currentStats, previousStats),
    sessions: bySession,
    byAmmunition,
  };
}

/** Si alguna ronda tiene análisis (si no, M07 muestra el estado "sin análisis todavía"). */
export function hasAnalyzedRounds(sessions: readonly Session[]): boolean {
  return sessions.some((session) => session.rounds.some((round) => round.analysis));
}

// --- Opciones de los filtros -----------------------------------------------------------------

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterOptions {
  configuration: FilterOption[];
  ammunitionId: FilterOption[];
  targetId: FilterOption[];
  rangeId: FilterOption[];
  /** Metros, de menor a mayor. */
  distanceM: number[];
}

/**
 * Lo que aparece en alguna sesión, por nombre (archivados incluidos: siguen en el historial). Así
 * ningún filtro ofrece una opción que deja la pantalla vacía de entrada.
 */
export function filterOptions(
  sessions: readonly Session[],
  lookups: SessionLookups,
  targets: readonly Target[],
): FilterOptions {
  const configurations = new Map<string, string>();
  const ammunition = new Set<string>();
  const ranges = new Set<string>();
  const targetIds = new Set<string>();
  const distances = new Set<number>();
  for (const session of sessions) {
    const value = firearmOptionValue(session.firearmId, session.configurationId);
    if (!configurations.has(value)) {
      const firearm = lookups.firearms.find((item) => item.id === session.firearmId);
      const configuration = session.configurationId
        ? lookups.configurations.find((item) => item.id === session.configurationId)
        : null;
      configurations.set(value, sessionTitle(firearm, configuration));
    }
    ammunition.add(session.ammunitionId);
    ranges.add(session.rangeId);
    for (const round of session.rounds) {
      targetIds.add(round.targetId);
      distances.add(round.distanceM);
    }
  }

  const named = <T extends { id: string }>(
    ids: Set<string>,
    items: readonly T[],
    name: (item: T) => string,
  ): FilterOption[] =>
    sortByName(
      items.filter((item) => ids.has(item.id)),
      name,
    ).map((item) => ({ value: item.id, label: name(item) }));

  return {
    configuration: sortByName(
      [...configurations].map(([value, label]) => ({ value, label })),
      (option) => option.label,
    ),
    ammunitionId: named<Ammunition>(ammunition, lookups.ammunition, ammunitionName),
    targetId: named(targetIds, targets, targetName),
    rangeId: named<Range>(ranges, lookups.ranges, (range) => range.name),
    distanceM: [...distances].filter((distance) => distance > 0).sort((a, b) => a - b),
  };
}

// --- Formato ---------------------------------------------------------------------------------

/** `25 m`, `10 / 25 m`. */
export function formatDistances(distances: readonly number[]): string {
  return distances.length === 0 ? '—' : `${distances.map(formatDecimal).join(' / ')} m`;
}

/** Símbolo de la medida del grupo y del PMI: `mm`, `in` o `MOA`. */
export function measureUnit(measure: Measure, units: Units): string {
  return measure === 'moa' ? 'MOA' : UNIT_SYMBOLS[units];
}

/** Número de una medida del grupo o del PMI (guardada en mm, o ya en MOA), sin la unidad. */
export function formatMeasureValue(value: number, measure: Measure, units: Units): string {
  const decimals = measure === 'moa' ? 2 : UNIT_DECIMALS[units];
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(measure === 'moa' ? value : fromMm(value, units));
}

export function formatMeasure(value: number, measure: Measure, units: Units): string {
  return `${formatMeasureValue(value, measure, units)} ${measureUnit(measure, units)}`;
}

/** `12,0 mm · 7 h`, o `Centrado`. */
export function formatMpi(stats: PerformanceStats, measure: Measure, units: Units): string {
  if (stats.mpiOffset === null) return '—';
  if (stats.mpiClock === null) return 'Centrado';
  return `${formatMeasure(stats.mpiOffset, measure, units)} · ${stats.mpiClock} h`;
}

// --- Tabla -----------------------------------------------------------------------------------

export const SORT_KEYS = ['date', 'shots', 'averagePerShot', 'groupSize', 'mpiOffset'] as const;

export type SortKey = (typeof SORT_KEYS)[number];

export type SortDirection = 'ascending' | 'descending';

export interface TableSort {
  key: SortKey;
  direction: SortDirection;
}

/** La más reciente primero. */
export const DEFAULT_SORT: TableSort = { key: 'date', direction: 'descending' };

function sortValue(row: SessionPerformance, key: SortKey): string | number | null {
  return key === 'date' ? row.session.date : row.stats[key];
}

/** Ordena las filas; las que no tienen valor van siempre al final. */
export function sortRows(
  rows: readonly SessionPerformance[],
  { key, direction }: TableSort,
): SessionPerformance[] {
  const sign = direction === 'ascending' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = sortValue(a, key);
    const right = sortValue(b, key);
    if (left === null || right === null) {
      return left === right ? 0 : left === null ? 1 : -1;
    }
    const order =
      typeof left === 'string' ? left.localeCompare(String(right)) : left - Number(right);
    return sign * (order || a.session.id.localeCompare(b.session.id));
  });
}

/** Al tocar una columna: si ya ordenaba, invierte; si no, empieza por la fecha más reciente o el número más alto. */
export function toggleSort(sort: TableSort, key: SortKey): TableSort {
  if (sort.key === key) {
    return { key, direction: sort.direction === 'ascending' ? 'descending' : 'ascending' };
  }
  return { key, direction: 'descending' };
}

// --- CSV -------------------------------------------------------------------------------------

/** Separador `;` y coma decimal, como lo abre Excel en castellano. */
const CSV_SEPARATOR = ';';

function csvCell(value: string): string {
  return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** CSV de la tabla, con encabezado. Las medidas van en la unidad de la pantalla. */
export function performanceCsv(
  rows: readonly SessionPerformance[],
  lookups: SessionLookups,
  measure: Measure,
  units: Units,
): string {
  const unit = measureUnit(measure, units);
  const header = [
    'Fecha',
    'Configuración',
    'Munición',
    'Polígono',
    'Distancia (m)',
    'Rondas',
    'Disparos',
    'Prom./tiro',
    `Grupo (${unit})`,
    `Desvío PMI (${unit})`,
    'Dirección PMI (h)',
  ];
  const lines = rows.map(({ session, distances, stats }) => {
    const labels = sessionLabels(session, lookups);
    return [
      formatIsoDate(session.date),
      labels.title,
      labels.ammunition,
      labels.range,
      distances.map(formatDecimal).join(' / '),
      String(stats.rounds),
      String(stats.shots),
      stats.averagePerShot === null ? '' : formatDecimal(stats.averagePerShot),
      stats.groupSize === null ? '' : formatMeasureValue(stats.groupSize, measure, units),
      stats.mpiOffset === null ? '' : formatMeasureValue(stats.mpiOffset, measure, units),
      stats.mpiClock === null ? '' : String(stats.mpiClock),
    ];
  });
  return [header, ...lines].map((line) => line.map(csvCell).join(CSV_SEPARATOR)).join('\r\n');
}

/** `rendimiento-2026-10-28.csv`. */
export function csvFileName(today: string): string {
  return `rendimiento-${today}.csv`;
}

// --- Deltas ----------------------------------------------------------------------------------

export interface DeltaDescription {
  direction: 'up' | 'down' | 'same';
  /** El valor absoluto formateado (`0,9`, `15,0 mm`). */
  amount: string;
  /** `null` si no cambió. */
  better: boolean | null;
}

/**
 * Cómo mostrar un delta: si subió o bajó (redondeado como se muestra) y si eso es mejor. En el
 * grupo y el desvío del PMI, menos es mejor.
 */
export function describeDelta(
  delta: number | null,
  format: (value: number) => string,
  lowerIsBetter = false,
): DeltaDescription | null {
  if (delta === null) return null;
  const amount = format(Math.abs(delta));
  if (!/[1-9]/.test(amount)) return { direction: 'same', amount, better: null };
  return {
    direction: delta > 0 ? 'up' : 'down',
    amount,
    better: lowerIsBetter ? delta < 0 : delta > 0,
  };
}
