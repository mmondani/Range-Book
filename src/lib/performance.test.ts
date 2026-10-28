import { describe, expect, it } from 'vitest';
import { parseAnalysis } from './analysis';
import { formatDecimal } from './format';
import type { Configuration, Firearm } from './firearms';
import type { Ammunition, Range } from './inventory';
import {
  DEFAULT_SORT,
  describeDelta,
  distanceParam,
  filterOptions,
  formatDistances,
  formatMeasure,
  formatMpi,
  hasActiveFilters,
  hasAnalyzedRounds,
  mostUsedDistance,
  parseFilters,
  performanceCsv,
  performanceReport,
  performanceStats,
  periodRange,
  previousPeriodRange,
  sortRows,
  toggleSort,
  type PerformanceFilters,
} from './performance';
import type { Round, Session, SessionLookups } from './sessions';
import type { Target } from './targets';

const TODAY = '2026-10-28';

/** Análisis con lo que lee Rendimiento: impactos, grupo y PMI (en mm). */
const analysis = (
  groupSizeMm: number,
  mpi: { x: number; y: number } = { x: 0, y: 0 },
  impacts = 5,
) => parseAnalysis({ metrics: { impacts, groupSizeMm, mpi } });

let nextRound = 0;
const round = (overrides: Partial<Round> = {}): Round => ({
  id: `r${++nextRound}`,
  targetId: 'issf',
  distanceM: 25,
  shots: 10,
  manualScore: null,
  score: null,
  photo: null,
  comments: '',
  analysis: null,
  ...overrides,
});

const session = (overrides: Partial<Session> = {}): Session => ({
  id: 's1',
  date: '2026-10-25',
  firearmId: 'glock',
  configurationId: 'ipsc',
  modificationsSnapshot: [],
  rangeId: 'norte',
  weather: null,
  ammunitionId: 'magtech',
  photos: [],
  notes: '',
  rounds: [],
  ...overrides,
});

const filters = (overrides: Partial<PerformanceFilters> = {}): PerformanceFilters => ({
  configuration: '',
  ammunitionId: '',
  targetId: '',
  rangeId: '',
  distanceM: undefined,
  period: '90d',
  ...overrides,
});

const GLOCK: Firearm = {
  id: 'glock',
  brand: 'Glock',
  model: '17 Gen5',
  caliber: '9×19 mm',
  purchaseDate: null,
  purchasePlace: '',
  priorShots: 0,
  photos: [],
  archived: false,
};
const IPSC: Configuration = {
  id: 'ipsc',
  name: 'Config. IPSC',
  firearmId: 'glock',
  modificationIds: ['holosun'],
  archived: false,
};
const MAGTECH: Ammunition = {
  id: 'magtech',
  brand: 'Magtech',
  model: '115gr',
  description: '',
  archived: false,
};
const SELLIER: Ammunition = {
  id: 'sellier',
  brand: 'S&B',
  model: '124gr',
  description: '',
  archived: true,
};
const NORTE: Range = { id: 'norte', name: 'Polígono Norte', address: '', archived: false };
const ISSF: Target = {
  id: 'issf',
  name: 'ISSF',
  photo: null,
  scoring: 'rings',
  referenceSizeMm: 500,
  zones: [{ score: 10, diameterMm: 50 }],
  archived: false,
};
const LOOKUPS: SessionLookups = {
  firearms: [GLOCK],
  configurations: [IPSC],
  ranges: [NORTE],
  ammunition: [MAGTECH, SELLIER],
};

describe('filtros en la query string', () => {
  it('sin parámetros: todo, la distancia más usada y los últimos 90 días', () => {
    expect(parseFilters(new URLSearchParams())).toEqual(filters());
  });

  it('lee cada filtro', () => {
    const params = new URLSearchParams(
      'configuracion=glock/ipsc&municion=magtech&blanco=issf&poligono=norte&distancia=25&periodo=30d',
    );
    expect(parseFilters(params)).toEqual({
      configuration: 'glock/ipsc',
      ammunitionId: 'magtech',
      targetId: 'issf',
      rangeId: 'norte',
      distanceM: 25,
      period: '30d',
    });
  });

  it('`distancia=todas` son todas; un valor inválido vuelve al default', () => {
    expect(parseFilters(new URLSearchParams('distancia=todas')).distanceM).toBeNull();
    expect(parseFilters(new URLSearchParams('distancia=abc')).distanceM).toBeUndefined();
    expect(parseFilters(new URLSearchParams('periodo=2d')).period).toBe('90d');
    expect(distanceParam(undefined)).toBe('');
    expect(distanceParam(null)).toBe('todas');
    expect(distanceParam(12.5)).toBe('12.5');
  });

  it('sabe si hay filtros distintos del default', () => {
    expect(hasActiveFilters(filters())).toBe(false);
    expect(hasActiveFilters(filters({ period: 'todo' }))).toBe(true);
    expect(hasActiveFilters(filters({ distanceM: null }))).toBe(true);
  });
});

describe('período', () => {
  it('los últimos N días incluyen hoy, y el anterior son los N días previos', () => {
    expect(periodRange('30d', TODAY)).toEqual({ from: '2026-09-29', to: '2026-10-28' });
    expect(previousPeriodRange('30d', TODAY)).toEqual({ from: '2026-08-30', to: '2026-09-28' });
    expect(periodRange('365d', '2026-03-01')).toEqual({ from: '2025-03-02', to: '2026-03-01' });
  });

  it('"Todo" no tiene límites ni período anterior', () => {
    expect(periodRange('todo', TODAY)).toBeNull();
    expect(previousPeriodRange('todo', TODAY)).toBeNull();
  });
});

describe('distancia por defecto', () => {
  it('es la de más rondas; a igual cantidad, la más corta', () => {
    const s = session();
    const entries = [10, 25, 25, 50, 50].map((distanceM) => ({
      session: s,
      round: round({ distanceM }),
    }));
    expect(mostUsedDistance(entries)).toBe(25);
    expect(mostUsedDistance([])).toBeNull();
  });

  it('el reporte filtra por la más usada del período si no se eligió otra', () => {
    const sessions = [
      session({
        rounds: [
          round({ distanceM: 25, shots: 10 }),
          round({ distanceM: 25, shots: 10 }),
          round({ distanceM: 10, shots: 5 }),
        ],
      }),
    ];
    const report = performanceReport(sessions, filters(), TODAY);
    expect(report.distanceM).toBe(25);
    expect(report.current.shots).toBe(20);
    expect(performanceReport(sessions, filters({ distanceM: 10 }), TODAY).current.shots).toBe(5);
    expect(performanceReport(sessions, filters({ distanceM: null }), TODAY).current.shots).toBe(25);
  });
});

describe('filtros', () => {
  const sessions = [
    session({ id: 'a', rounds: [round({ shots: 1 })] }),
    session({ id: 'b', configurationId: null, rounds: [round({ shots: 2 })] }),
    session({ id: 'c', ammunitionId: 'sellier', rounds: [round({ shots: 4 })] }),
    session({ id: 'd', rangeId: 'sur', rounds: [round({ shots: 8 })] }),
    session({ id: 'e', rounds: [round({ shots: 16, targetId: 'b8' })] }),
    session({ id: 'f', date: '2026-01-10', rounds: [round({ shots: 32 })] }),
  ];
  const shots = (overrides: Partial<PerformanceFilters>) =>
    performanceReport(sessions, filters({ distanceM: null, ...overrides }), TODAY).current.shots;

  it('sin filtros suma las rondas del período', () => {
    expect(shots({})).toBe(31);
    expect(shots({ period: 'todo' })).toBe(63);
  });

  it('por configuración: "Stock" es el arma sin configuración', () => {
    expect(shots({ configuration: 'glock' })).toBe(2);
    expect(shots({ configuration: 'glock/ipsc' })).toBe(29);
  });

  it('por munición, polígono y blanco', () => {
    expect(shots({ ammunitionId: 'sellier' })).toBe(4);
    expect(shots({ rangeId: 'sur' })).toBe(8);
    expect(shots({ targetId: 'b8' })).toBe(16);
  });
});

describe('estadísticas', () => {
  it('promedio por tiro de las rondas con puntaje (confirmado o manual)', () => {
    const s = session();
    const stats = performanceStats(
      [
        { session: s, round: round({ shots: 10, score: 95, manualScore: 90 }) },
        { session: s, round: round({ shots: 10, manualScore: 85 }) },
        { session: s, round: round({ shots: 10 }) },
      ],
      'length',
    );
    expect(stats.shots).toBe(30);
    expect(stats.averagePerShot).toBe(9);
  });

  it('grupo promedio de las rondas analizadas y PMI pesado por impactos', () => {
    const s = session();
    const stats = performanceStats(
      [
        { session: s, round: round({ analysis: analysis(40, { x: -12, y: 0 }, 3) }) },
        { session: s, round: round({ analysis: analysis(60, { x: 0, y: -16 }, 1) }) },
        { session: s, round: round() },
      ],
      'length',
    );
    expect(stats.analyzedRounds).toBe(2);
    expect(stats.groupSize).toBe(50);
    // PMI = (-36 + 0, 0 - 16) / 4 = (-9, -4).
    expect(stats.mpiOffset).toBeCloseTo(Math.hypot(9, 4));
    expect(stats.mpiClock).toBe(8);
  });

  it('en MOA convierte cada ronda con su distancia', () => {
    const s = session();
    const stats = performanceStats(
      [
        { session: s, round: round({ distanceM: 25, analysis: analysis(25 * 0.2909 * 2) }) },
        { session: s, round: round({ distanceM: 50, analysis: analysis(50 * 0.2909 * 4) }) },
      ],
      'moa',
    );
    expect(stats.groupSize).toBeCloseTo(3);
  });

  it('con distancias mezcladas el reporte mide en MOA; con una sola, en longitud', () => {
    const mixed = [
      session({
        rounds: [
          round({ distanceM: 25, analysis: analysis(30) }),
          round({ distanceM: 50, analysis: analysis(60) }),
        ],
      }),
    ];
    expect(performanceReport(mixed, filters({ distanceM: null }), TODAY).measure).toBe('moa');
    expect(performanceReport(mixed, filters(), TODAY).measure).toBe('length');
  });

  it('sin análisis no hay grupo ni PMI', () => {
    const stats = performanceStats([{ session: session(), round: round() }], 'length');
    expect(stats.groupSize).toBeNull();
    expect(stats.mpiOffset).toBeNull();
    expect(stats.mpiClock).toBeNull();
  });
});

describe('deltas contra el período anterior', () => {
  const sessions = [
    session({
      id: 'actual',
      date: '2026-10-20',
      rounds: [round({ shots: 10, manualScore: 92, analysis: analysis(40, { x: 3, y: 4 }) })],
    }),
    session({
      id: 'anterior',
      date: '2026-07-01',
      rounds: [round({ shots: 20, manualScore: 170, analysis: analysis(55, { x: 6, y: 8 }) })],
    }),
    session({ id: 'vieja', date: '2025-01-01', rounds: [round({ shots: 99, manualScore: 0 })] }),
  ];

  it('compara con los N días previos, con los mismos filtros', () => {
    const report = performanceReport(sessions, filters(), TODAY);
    expect(report.current.sessions).toBe(1);
    expect(report.previous?.sessions).toBe(1);
    expect(report.deltas.averagePerShot).toBeCloseTo(9.2 - 8.5);
    expect(report.deltas.groupSize).toBe(-15);
    expect(report.deltas.mpiOffset).toBeCloseTo(5 - 10);
    expect(report.deltas.shots).toBe(-10);
  });

  it('sin datos en el período anterior, o en "Todo", no hay delta', () => {
    const report = performanceReport(sessions, filters({ period: '30d' }), TODAY);
    expect(report.previous?.rounds).toBe(0);
    expect(report.deltas.averagePerShot).toBeNull();
    expect(performanceReport(sessions, filters({ period: 'todo' }), TODAY).previous).toBeNull();
  });
});

describe('series por sesión y por munición', () => {
  const sessions = [
    session({
      id: 'b',
      date: '2026-10-20',
      ammunitionId: 'sellier',
      rounds: [round({ shots: 10, manualScore: 80 }), round({ shots: 10, manualScore: 90 })],
    }),
    session({
      id: 'a',
      date: '2026-10-01',
      rounds: [round({ shots: 10, manualScore: 95, distanceM: 25 })],
    }),
  ];

  it('las sesiones van de la más vieja a la más reciente, con sus distancias', () => {
    const report = performanceReport(sessions, filters(), TODAY);
    expect(report.sessions.map((row) => row.session.id)).toEqual(['a', 'b']);
    expect(report.sessions[1]?.stats.averagePerShot).toBe(8.5);
    expect(report.sessions[0]?.distances).toEqual([25]);
  });

  it('las municiones van de mejor a peor promedio', () => {
    const report = performanceReport(sessions, filters(), TODAY);
    expect(report.byAmmunition.map((item) => item.ammunitionId)).toEqual(['magtech', 'sellier']);
  });
});

describe('opciones de los filtros', () => {
  it('solo lo usado en alguna sesión, archivados incluidos, por nombre', () => {
    const sessions = [
      session({ rounds: [round({ distanceM: 50 }), round({ distanceM: 10 })] }),
      session({ id: 's2', configurationId: null, ammunitionId: 'sellier' }),
    ];
    const options = filterOptions(sessions, LOOKUPS, [ISSF]);
    expect(options.configuration).toEqual([
      { value: 'glock/ipsc', label: 'Glock 17 Gen5 · Config. IPSC' },
      { value: 'glock', label: 'Glock 17 Gen5 · Stock' },
    ]);
    expect(options.ammunitionId.map((option) => option.label)).toEqual([
      'Magtech 115gr',
      'S&B 124gr',
    ]);
    expect(options.rangeId).toEqual([{ value: 'norte', label: 'Polígono Norte' }]);
    expect(options.targetId).toEqual([{ value: 'issf', label: 'ISSF' }]);
    expect(options.distanceM).toEqual([10, 50]);
  });
});

describe('estado sin análisis', () => {
  it('detecta si alguna ronda está analizada', () => {
    expect(hasAnalyzedRounds([session({ rounds: [round()] })])).toBe(false);
    expect(hasAnalyzedRounds([session({ rounds: [round({ analysis: analysis(10) })] })])).toBe(
      true,
    );
  });
});

describe('tabla', () => {
  const rows = performanceReport(
    [
      session({ id: 'a', date: '2026-10-01', rounds: [round({ shots: 30, manualScore: 270 })] }),
      session({ id: 'b', date: '2026-10-10', rounds: [round({ shots: 10 })] }),
      session({ id: 'c', date: '2026-10-20', rounds: [round({ shots: 20, manualScore: 190 })] }),
    ],
    filters(),
    TODAY,
  ).sessions;
  const ids = (sorted: typeof rows) => sorted.map((row) => row.session.id);

  it('por defecto, la más reciente primero', () => {
    expect(ids(sortRows(rows, DEFAULT_SORT))).toEqual(['c', 'b', 'a']);
  });

  it('ordena por número y deja sin valor al final en los dos sentidos', () => {
    expect(ids(sortRows(rows, { key: 'shots', direction: 'ascending' }))).toEqual(['b', 'c', 'a']);
    expect(ids(sortRows(rows, { key: 'averagePerShot', direction: 'descending' }))).toEqual([
      'c',
      'a',
      'b',
    ]);
    expect(ids(sortRows(rows, { key: 'averagePerShot', direction: 'ascending' }))).toEqual([
      'a',
      'c',
      'b',
    ]);
  });

  it('tocar la misma columna invierte; otra, empieza descendente', () => {
    expect(toggleSort(DEFAULT_SORT, 'date')).toEqual({ key: 'date', direction: 'ascending' });
    expect(toggleSort(DEFAULT_SORT, 'groupSize')).toEqual({
      key: 'groupSize',
      direction: 'descending',
    });
  });
});

describe('formato', () => {
  it('distancias, medidas y PMI', () => {
    expect(formatDistances([10, 25])).toBe('10 / 25 m');
    expect(formatDistances([])).toBe('—');
    expect(formatMeasure(25.4, 'length', 'in')).toBe('1,00 in');
    expect(formatMeasure(46, 'length', 'mm')).toBe('46,0 mm');
    expect(formatMeasure(1.234, 'moa', 'mm')).toBe('1,23 MOA');
    const stats = performanceStats(
      [{ session: session(), round: round({ analysis: analysis(10, { x: -12, y: 0 }) }) }],
      'length',
    );
    expect(formatMpi(stats, 'length', 'mm')).toBe('12,0 mm · 9 h');
  });
});

describe('CSV', () => {
  it('encabezado, separador `;`, coma decimal y comillas cuando hace falta', () => {
    const report = performanceReport(
      [
        session({
          id: 'a',
          ammunitionId: 'sellier',
          rangeId: 'norte',
          notes: '',
          rounds: [
            round({ shots: 10, manualScore: 92, analysis: analysis(46.04, { x: 0, y: 12 }) }),
          ],
        }),
      ],
      filters(),
      TODAY,
    );
    const lookups = { ...LOOKUPS, ranges: [{ ...NORTE, name: 'Norte; sede "A"' }] };
    const csv = performanceCsv(report.sessions, lookups, report.measure, 'mm').split('\r\n');
    expect(csv[0]).toBe(
      'Fecha;Configuración;Munición;Polígono;Distancia (m);Rondas;Disparos;Prom./tiro;Grupo (mm);Desvío PMI (mm);Dirección PMI (h)',
    );
    expect(csv[1]).toBe(
      '25/10/2026;Glock 17 Gen5 · Config. IPSC;S&B 124gr;"Norte; sede ""A""";25;1;10;9,2;46,0;12,0;12',
    );
  });
});

describe('describeDelta', () => {
  it('sube o baja, y si es mejor según la métrica', () => {
    expect(describeDelta(0.7, formatDecimal)).toEqual({
      direction: 'up',
      amount: '0,7',
      better: true,
    });
    expect(describeDelta(-15, (value) => `${formatDecimal(value)} mm`, true)).toEqual({
      direction: 'down',
      amount: '15 mm',
      better: true,
    });
    expect(describeDelta(3, formatDecimal, true)?.better).toBe(false);
  });

  it('si redondeado no cambia es "igual"; sin delta, nada', () => {
    expect(describeDelta(0.04, formatDecimal)).toEqual({
      direction: 'same',
      amount: '0',
      better: null,
    });
    expect(describeDelta(null, formatDecimal)).toBeNull();
  });
});
