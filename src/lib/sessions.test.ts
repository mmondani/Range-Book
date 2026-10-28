import { parseAnalysis } from './analysis';
import { describe, expect, it } from 'vitest';
import type { Configuration, Firearm, Modification } from './firearms';
import type { Ammunition, Range } from './inventory';
import { pendingPhoto } from './photos';
import {
  availableModifications,
  changeFirearm,
  draftStorageKey,
  filterSessions,
  firearmOptions,
  firearmOptionValue,
  groupByMonth,
  lastAmmunitionId,
  lastRangeId,
  monthSummary,
  newSessionDraft,
  parseFirearmOption,
  parseSession,
  parseStoredDraft,
  serializeDraft,
  sessionDraft,
  sessionFields,
  sessionFirearms,
  sessionLabels,
  sessionPhotoPaths,
  sessionTotals,
  sortSessions,
  validateSession,
  type Round,
  type Session,
  type SessionDraft,
} from './sessions';
import type { Target } from './targets';

/** Análisis mínimo: solo el tamaño de grupo. */
const withGroup = (groupSizeMm: number) => parseAnalysis({ metrics: { groupSizeMm } });

const firearm = (id: string, brand: string, model: string, archived = false): Firearm => ({
  id,
  brand,
  model,
  caliber: '9×19 mm',
  purchaseDate: null,
  purchasePlace: '',
  priorShots: 0,
  photos: [],
  archived,
});

const GLOCK = firearm('glock', 'Glock', '17 Gen5');
const CZ = firearm('cz', 'CZ', 'Shadow 2');
const BERSA = firearm('bersa', 'Bersa', 'Thunder', true);

const mod = (id: string, brand: string, model: string, archived = false): Modification => ({
  id,
  brand,
  model,
  comments: '',
  archived,
});

const HOLOSUN = mod('holosun', 'Holosun', '507C');
const ZEV = mod('zev', 'Zev', 'PRO Trigger');
const TARAN = mod('taran', 'Taran', 'Base +2', true);

const config = (
  id: string,
  name: string,
  modificationIds: string[],
  archived = false,
): Configuration => ({ id, name, firearmId: 'glock', modificationIds, archived });

const IPSC = config('ipsc', 'Config. IPSC', ['holosun', 'zev']);
const NIGHT = config('night', 'Nocturna', ['holosun'], true);

const NORTE: Range = { id: 'norte', name: 'Polígono Norte', address: '', archived: false };
const ALAMOS: Range = { id: 'alamos', name: 'Los Álamos', address: '', archived: false };
const VIEJO: Range = { id: 'viejo', name: 'Club Viejo', address: '', archived: true };

const ammo = (id: string, brand: string, archived = false): Ammunition => ({
  id,
  brand,
  model: '9mm',
  description: '',
  archived,
});
const MAGTECH = ammo('magtech', 'Magtech');
const SELLIER = ammo('sellier', 'Sellier');
const VIEJA = ammo('vieja', 'Vieja', true);

const ISSF: Target = {
  id: 'issf',
  name: 'ISSF',
  photo: null,
  scoring: 'rings',
  referenceSizeMm: 500,
  zones: [
    { score: 10, diameterMm: 50 },
    { score: 9, diameterMm: 100 },
  ],
  archived: false,
};
const SILUETA: Target = { ...ISSF, id: 'silueta', scoring: 'none', zones: [] };

const round = (overrides: Partial<Round> = {}): Round => ({
  id: 'r1',
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
  modificationsSnapshot: [
    { brand: 'Holosun', model: '507C' },
    { brand: 'Zev', model: 'PRO Trigger' },
  ],
  rangeId: 'norte',
  weather: 'sunny',
  ammunitionId: 'magtech',
  photos: [],
  notes: '',
  rounds: [],
  ...overrides,
});

const TODAY = '2026-10-28';

const draft = (overrides: Partial<SessionDraft> = {}): SessionDraft => ({
  ...newSessionDraft([], [], TODAY),
  firearm: 'glock/ipsc',
  rangeId: 'norte',
  ammunitionId: 'magtech',
  ...overrides,
});

describe('opciones de arma / configuración', () => {
  it('codifica arma y configuración en el valor del select', () => {
    expect(firearmOptionValue('glock', null)).toBe('glock');
    expect(firearmOptionValue('glock', 'ipsc')).toBe('glock/ipsc');
    expect(parseFirearmOption('glock')).toEqual({ firearmId: 'glock', configurationId: null });
    expect(parseFirearmOption('glock/ipsc')).toEqual({
      firearmId: 'glock',
      configurationId: 'ipsc',
    });
    expect(parseFirearmOption('')).toEqual({ firearmId: '', configurationId: null });
  });

  it('agrupa por arma: "Stock" primero y las configuraciones activas', () => {
    const groups = firearmOptions([GLOCK, CZ, BERSA], [IPSC, NIGHT]);
    expect(groups.map((group) => group.label)).toEqual(['CZ Shadow 2', 'Glock 17 Gen5']);
    expect(groups[1]!.options).toEqual([
      { value: 'glock', label: 'Glock 17 Gen5 · Stock' },
      { value: 'glock/ipsc', label: 'Glock 17 Gen5 · Config. IPSC' },
    ]);
  });

  it('conserva el arma y la configuración archivadas si ya estaban elegidas', () => {
    const withBersa = firearmOptions([GLOCK, BERSA], [IPSC, NIGHT], 'bersa');
    expect(withBersa.map((group) => group.label)).toContain('Bersa Thunder');
    const withNight = firearmOptions([GLOCK], [IPSC, NIGHT], 'glock/night');
    expect(withNight[0]!.options.map((option) => option.value)).toContain('glock/night');
  });
});

describe('personalizaciones', () => {
  it('al elegir una configuración precarga sus modificaciones; "Stock" no tiene', () => {
    const context = {
      sessions: [],
      configurations: [IPSC],
      modifications: [HOLOSUN, ZEV, TARAN],
      ammunition: [MAGTECH],
    };
    expect(changeFirearm(draft({ firearm: '' }), 'glock/ipsc', context).modifications).toEqual([
      { id: 'holosun', brand: 'Holosun', model: '507C' },
      { id: 'zev', brand: 'Zev', model: 'PRO Trigger' },
    ]);
    expect(changeFirearm(draft(), 'glock', context).modifications).toEqual([]);
  });

  it('"Agregar" ofrece las activas del arma que no están, también comparando por nombre', () => {
    expect(
      availableModifications(
        [{ id: 'holosun', brand: 'Holosun', model: '507C' }],
        [HOLOSUN, ZEV, TARAN],
      ),
    ).toEqual([ZEV]);
    // Una sesión guardada solo tiene la copia (sin id).
    expect(
      availableModifications([{ id: null, brand: 'zev', model: 'pro trigger' }], [HOLOSUN, ZEV]),
    ).toEqual([HOLOSUN]);
  });

  it('el snapshot es inmune a cambios posteriores del inventario', () => {
    const modifications = [{ ...HOLOSUN }, { ...ZEV }];
    const option = changeFirearm(draft({ firearm: '' }), 'glock/ipsc', {
      sessions: [],
      configurations: [IPSC],
      modifications,
      ammunition: [],
    });
    const fields = sessionFields(draft(option), []);
    // Se edita y se archiva la modificación en el inventario después de guardar.
    modifications[0]!.model = '508T';
    modifications[0]!.archived = true;
    expect(fields.modificationsSnapshot).toEqual([
      { brand: 'Holosun', model: '507C' },
      { brand: 'Zev', model: 'PRO Trigger' },
    ]);
    // Al editar la sesión se parte de la copia, no del inventario.
    const reopened = sessionDraft({ ...session(), ...fields });
    expect(reopened.modifications.map((item) => item.model)).toEqual(['507C', 'PRO Trigger']);
    // Y solo se guardan marca y modelo.
    expect(Object.keys(fields.modificationsSnapshot[0]!)).toEqual(['brand', 'model']);
  });
});

describe('defaults', () => {
  const sessions = [
    session({ id: 'a', date: '2026-10-01', rangeId: 'alamos', ammunitionId: 'sellier' }),
    session({ id: 'b', date: '2026-10-20', rangeId: 'norte', ammunitionId: 'magtech' }),
    session({ id: 'c', date: '2026-10-10', firearmId: 'cz', rangeId: 'alamos' }),
  ];

  it('fecha de hoy, el último polígono usado y sin arma', () => {
    expect(newSessionDraft(sessions, [NORTE, ALAMOS], TODAY)).toEqual({
      firearm: '',
      modifications: [],
      date: TODAY,
      rangeId: 'norte',
      weather: null,
      ammunitionId: '',
      photos: [],
      notes: '',
    });
  });

  it('si el último polígono se archivó, usa el anterior que siga activo', () => {
    const withOld = [...sessions, session({ id: 'd', date: '2026-10-27', rangeId: 'viejo' })];
    expect(lastRangeId(withOld, [NORTE, ALAMOS, VIEJO])).toBe('norte');
    expect(lastRangeId([], [NORTE])).toBe('');
  });

  it('la última munición usada con esa arma', () => {
    expect(lastAmmunitionId(sessions, 'glock', [MAGTECH, SELLIER])).toBe('magtech');
    expect(lastAmmunitionId(sessions, 'ruger', [MAGTECH, SELLIER])).toBe('');
    const archived = [session({ id: 'z', date: '2026-10-27', ammunitionId: 'vieja' })];
    expect(lastAmmunitionId([...sessions, ...archived], 'glock', [MAGTECH, VIEJA])).toBe('magtech');
  });

  it('al cambiar de arma propone su última munición; si no hay, conserva la elegida', () => {
    const context = {
      sessions,
      configurations: [IPSC],
      modifications: [],
      ammunition: [MAGTECH, SELLIER],
    };
    expect(
      changeFirearm(draft({ firearm: '', ammunitionId: '' }), 'glock', context).ammunitionId,
    ).toBe('magtech');
    expect(changeFirearm(draft({ ammunitionId: 'sellier' }), 'ruger', context).ammunitionId).toBe(
      'sellier',
    );
    // Cambiar de configuración de la misma arma no toca la munición.
    expect(
      changeFirearm(draft({ firearm: 'glock', ammunitionId: 'sellier' }), 'glock/ipsc', context)
        .ammunitionId,
    ).toBe('sellier');
  });
});

describe('validateSession', () => {
  it('arma, fecha, polígono y munición son obligatorios', () => {
    expect(
      validateSession(draft({ firearm: '', date: '', rangeId: '', ammunitionId: '' }), TODAY),
    ).toEqual({
      firearm: 'Elegí el arma o una configuración',
      date: 'Ingresá la fecha',
      rangeId: 'Elegí el polígono',
      ammunitionId: 'Elegí la munición',
    });
    expect(validateSession(draft(), TODAY)).toEqual({});
  });

  it('la fecha tiene que existir y no ser futura', () => {
    expect(validateSession(draft({ date: '2026-02-30' }), TODAY).date).toBe(
      'Ingresá una fecha válida',
    );
    expect(validateSession(draft({ date: '2026-10-29' }), TODAY).date).toBe(
      'La fecha no puede ser futura',
    );
    expect(validateSession(draft({ date: TODAY }), TODAY).date).toBeUndefined();
  });

  it('limita fotos y notas', () => {
    const photos = Array.from({ length: 21 }, (_, index) =>
      pendingPhoto(new Blob(), `${index}.jpg`, `p${index}`),
    );
    const errors = validateSession(draft({ photos, notes: 'x'.repeat(2001) }), TODAY);
    expect(errors.photos).toBe('Podés cargar hasta 20 fotos');
    expect(errors.notes).toBe('Las notas pueden tener hasta 2000 caracteres');
  });
});

describe('sessionFields', () => {
  it('separa arma y configuración y limpia las notas', () => {
    expect(
      sessionFields(draft({ firearm: 'glock', notes: '  Viento leve  ', weather: 'windy' }), [
        'users/ana/sessions/s1/a.jpg',
      ]),
    ).toEqual({
      date: TODAY,
      firearmId: 'glock',
      configurationId: null,
      modificationsSnapshot: [],
      rangeId: 'norte',
      weather: 'windy',
      ammunitionId: 'magtech',
      photos: ['users/ana/sessions/s1/a.jpg'],
      notes: 'Viento leve',
    });
  });
});

describe('borrador local', () => {
  it('usa una clave por usuario y por sesión', () => {
    expect(draftStorageKey('ana')).toBe('rb-session-draft:ana:nueva');
    expect(draftStorageKey('ana', 's1')).toBe('rb-session-draft:ana:s1');
  });

  it('guarda y recupera el borrador, sin las fotos pendientes', () => {
    const original = draft({
      modifications: [{ id: 'holosun', brand: 'Holosun', model: '507C' }],
      weather: 'fog',
      notes: 'Práctica',
      photos: [
        { status: 'stored', path: 'users/ana/sessions/s1/a.jpg' },
        pendingPhoto(new Blob(), 'b.jpg', 'b'),
      ],
    });
    expect(parseStoredDraft(serializeDraft(original))).toEqual({
      ...original,
      photos: [{ status: 'stored', path: 'users/ana/sessions/s1/a.jpg' }],
    });
  });

  it('ignora borradores dañados', () => {
    expect(parseStoredDraft(null)).toBeUndefined();
    expect(parseStoredDraft('{no es json')).toBeUndefined();
    expect(parseStoredDraft('{"weather":"tornado","date":5}')).toMatchObject({
      weather: null,
      date: '',
    });
  });
});

describe('sessionTotals', () => {
  it('suma disparos, puntaje y máximo de las rondas con puntaje', () => {
    const totals = sessionTotals(
      session({
        rounds: [
          round({ shots: 15, manualScore: 136 }),
          round({ id: 'r2', shots: 15, manualScore: 120, score: 131 }),
          round({ id: 'r3', shots: 5 }),
        ],
      }),
      [ISSF],
    );
    expect(totals).toEqual({
      rounds: 3,
      shots: 35,
      // El confirmado del análisis tiene prioridad sobre el manual.
      score: 267,
      maxScore: 300,
      averagePerShot: 8.9,
      groupSizeMm: null,
    });
  });

  it('sin máximo si alguna ronda con puntaje usa un blanco sin zonas', () => {
    const totals = sessionTotals(
      session({
        rounds: [
          round({ manualScore: 90 }),
          round({ id: 'r2', targetId: 'silueta', manualScore: 40 }),
        ],
      }),
      [ISSF, SILUETA],
    );
    expect(totals.score).toBe(130);
    expect(totals.maxScore).toBeNull();
  });

  it('promedia el tamaño de grupo de las rondas analizadas', () => {
    const totals = sessionTotals(
      session({
        rounds: [
          round({ analysis: withGroup(40) }),
          round({ id: 'r2', analysis: withGroup(52) }),
          round({ id: 'r3' }),
        ],
      }),
    );
    expect(totals.groupSizeMm).toBe(46);
    expect(totals.score).toBeNull();
    expect(totals.averagePerShot).toBeNull();
  });

  it('una sesión sin rondas', () => {
    expect(sessionTotals(session())).toEqual({
      rounds: 0,
      shots: 0,
      score: null,
      maxScore: null,
      averagePerShot: null,
      groupSizeMm: null,
    });
  });
});

describe('lista', () => {
  const sessions = [
    session({ id: 'a', date: '2026-09-27' }),
    session({ id: 'b', date: '2026-10-25', rounds: [round({ shots: 20, manualScore: 180 })] }),
    session({ id: 'c', date: '2026-10-11', rounds: [round({ shots: 10 })] }),
    session({ id: 'd', date: '2026-10-25' }),
  ];

  it('ordena de la más reciente a la más vieja', () => {
    expect(sortSessions(sessions).map((item) => item.id)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('agrupa por mes', () => {
    expect(
      groupByMonth(sessions).map((group) => [group.month, group.sessions.map((s) => s.id)]),
    ).toEqual([
      ['2026-10', ['d', 'b', 'c']],
      ['2026-09', ['a']],
    ]);
  });

  it('resume el mes actual', () => {
    expect(monthSummary(sessions, TODAY)).toEqual({
      sessions: 3,
      shots: 30,
      averagePerShot: 9,
    });
    expect(monthSummary(sessions, '2026-11-02')).toEqual({
      sessions: 0,
      shots: 0,
      averagePerShot: null,
    });
  });

  const lookups = {
    firearms: [GLOCK, CZ],
    configurations: [IPSC],
    ranges: [NORTE, ALAMOS],
    ammunition: [MAGTECH, SELLIER],
  };

  it('arma los nombres de la tarjeta', () => {
    expect(sessionLabels(session(), lookups)).toEqual({
      title: 'Glock 17 Gen5 · Config. IPSC',
      range: 'Polígono Norte',
      ammunition: 'Magtech 9mm',
    });
    expect(sessionLabels(session({ configurationId: null, rangeId: 'x' }), lookups)).toMatchObject({
      title: 'Glock 17 Gen5 · Stock',
      range: '—',
    });
  });

  it('busca por arma, polígono, munición, personalizaciones y notas, y filtra por arma', () => {
    const list = [
      session({ id: 'a', notes: 'Viento fuerte' }),
      session({
        id: 'b',
        firearmId: 'cz',
        configurationId: null,
        rangeId: 'alamos',
        ammunitionId: 'sellier',
        modificationsSnapshot: [],
      }),
    ];
    const ids = (query: string, firearmId = '') =>
      filterSessions(list, { query, firearmId }, lookups).map((item) => item.id);
    expect(ids('')).toEqual(['a', 'b']);
    expect(ids('alamos')).toEqual(['b']);
    expect(ids('shadow sellier')).toEqual(['b']);
    expect(ids('holosun')).toEqual(['a']);
    expect(ids('viento')).toEqual(['a']);
    expect(ids('', 'cz')).toEqual(['b']);
    expect(ids('viento', 'cz')).toEqual([]);
  });

  it('las armas del filtro son las que tienen sesiones', () => {
    expect(sessionFirearms([session(), session({ firearmId: 'glock' })], [GLOCK, CZ])).toEqual([
      GLOCK,
    ]);
  });
});

describe('Firestore', () => {
  it('lee una sesión con sus rondas, tolerando datos faltantes', () => {
    const parsed = parseSession('s1', {
      date: '2026-10-25',
      firearmId: 'glock',
      configurationId: null,
      modificationsSnapshot: [{ brand: 'Holosun', model: '507C' }, { brand: 1 }],
      rangeId: 'norte',
      weather: 'granizo',
      ammunitionId: 'magtech',
      photos: ['a.jpg', 3],
      notes: 'ok',
      rounds: [
        {
          id: 'r1',
          targetId: 'issf',
          distanceM: 25,
          shots: 15,
          manualScore: 136,
          photo: 'r.jpg',
          analysis: { metrics: { groupSizeMm: 46 } },
        },
      ],
    });
    expect(parsed).toMatchObject({
      configurationId: null,
      modificationsSnapshot: [{ brand: 'Holosun', model: '507C' }],
      weather: null,
      photos: ['a.jpg'],
    });
    expect(parsed.rounds[0]).toEqual({
      id: 'r1',
      targetId: 'issf',
      distanceM: 25,
      shots: 15,
      manualScore: 136,
      score: null,
      photo: 'r.jpg',
      comments: '',
      analysis: withGroup(46),
    });
    expect(parseSession('x', {})).toMatchObject({ date: '', rounds: [], photos: [] });
  });

  it('junta las fotos de la sesión y de sus rondas', () => {
    expect(
      sessionPhotoPaths(
        session({ photos: ['a.jpg'], rounds: [round({ photo: 'r.jpg' }), round({ id: 'r2' })] }),
      ),
    ).toEqual(['a.jpg', 'r.jpg']);
  });
});
