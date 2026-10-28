import { parseAnalysis } from './analysis';
import { describe, expect, it } from 'vitest';
import { pendingPhoto, storedPhotos } from './photos';
import {
  DEFAULT_SHOTS,
  discardsAnalysis,
  newRoundDraft,
  rawRounds,
  removeRawRound,
  restoreRawRound,
  roundDraft,
  roundFields,
  roundItems,
  roundMaxScore,
  roundTargets,
  saveRawRound,
  validateRound,
  type RoundDraft,
} from './rounds';
import type { Round, Session } from './sessions';
import type { Target } from './targets';

/** Análisis mínimo: solo el tamaño de grupo. */
const withGroup = (groupSizeMm: number) => parseAnalysis({ metrics: { groupSizeMm } });

const ISSF: Target = {
  id: 'issf',
  name: 'ISSF Pistola Precisión',
  photo: null,
  scoring: 'rings',
  referenceSizeMm: 500,
  zones: [
    { score: 10, diameterMm: 50 },
    { score: 9, diameterMm: 100 },
  ],
  archived: false,
};
const SILUETA: Target = { ...ISSF, id: 'silueta', name: 'Silueta', scoring: 'none', zones: [] };
const VIEJO: Target = { ...ISSF, id: 'viejo', name: 'Viejo', archived: true };
const TARGETS = [ISSF, SILUETA, VIEJO];

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
  configurationId: null,
  modificationsSnapshot: [],
  rangeId: 'norte',
  weather: null,
  ammunitionId: 'magtech',
  photos: [],
  notes: '',
  rounds: [],
  ...overrides,
});

const draft = (overrides: Partial<RoundDraft> = {}): RoundDraft => ({
  targetId: 'issf',
  distance: '25',
  shots: 10,
  manualScore: '',
  photos: [],
  comments: '',
  ...overrides,
});

describe('newRoundDraft', () => {
  it('precarga el blanco, la distancia y los disparos de la ronda anterior de la sesión', () => {
    const current = session({
      rounds: [
        round({ targetId: 'silueta', distanceM: 7, shots: 6 }),
        round({ id: 'r2', distanceM: 12.5, shots: 15 }),
      ],
    });
    expect(newRoundDraft(current, [current], TARGETS)).toEqual({
      targetId: 'issf',
      distance: '12,5',
      shots: 15,
      manualScore: '',
      photos: [],
      comments: '',
    });
  });

  it('en la primera ronda de la sesión usa la última ronda de la sesión más reciente', () => {
    const current = session({ id: 'nueva', date: '2026-10-28' });
    const older = session({ id: 'a', date: '2026-09-01', rounds: [round({ distanceM: 50 })] });
    const newer = session({
      id: 'b',
      date: '2026-10-20',
      rounds: [round(), round({ id: 'r2', targetId: 'silueta', distanceM: 10, shots: 5 })],
    });
    expect(newRoundDraft(current, [older, current, newer], TARGETS)).toMatchObject({
      targetId: 'silueta',
      distance: '10',
      shots: 5,
    });
  });

  it('si el último blanco se archivó, usa el anterior que siga activo', () => {
    const current = session({
      rounds: [round({ targetId: 'silueta' }), round({ id: 'r2', targetId: 'viejo', shots: 8 })],
    });
    expect(newRoundDraft(current, [current], TARGETS)).toMatchObject({
      targetId: 'silueta',
      shots: 8,
    });
  });

  it('sin rondas anteriores: sin blanco ni distancia, y los disparos por defecto', () => {
    const current = session();
    expect(newRoundDraft(current, [current], TARGETS)).toMatchObject({
      targetId: '',
      distance: '',
      shots: DEFAULT_SHOTS,
    });
  });
});

describe('roundDraft / roundFields', () => {
  it('ida y vuelta de una ronda guardada', () => {
    const saved = round({
      distanceM: 22.5,
      shots: 12,
      manualScore: 98,
      photo: 'users/ana/rounds/r1/a.jpg',
      comments: 'Viento',
    });
    const value = roundDraft(saved);
    expect(value).toEqual({
      targetId: 'issf',
      distance: '22,5',
      shots: 12,
      manualScore: '98',
      photos: storedPhotos(['users/ana/rounds/r1/a.jpg']),
      comments: 'Viento',
    });
    expect(roundFields(value, saved.photo)).toEqual({
      targetId: 'issf',
      distanceM: 22.5,
      shots: 12,
      manualScore: 98,
      photo: 'users/ana/rounds/r1/a.jpg',
      comments: 'Viento',
    });
  });

  it('el puntaje vacío se guarda como null y los comentarios sin espacios de más', () => {
    expect(roundFields(draft({ distance: '7.5', comments: '  ok  ' }), null)).toMatchObject({
      distanceM: 7.5,
      manualScore: null,
      comments: 'ok',
    });
  });
});

describe('roundTargets', () => {
  it('ofrece los activos, por nombre, y el archivado solo si ya estaba elegido', () => {
    expect(roundTargets(TARGETS, 'issf').map((target) => target.id)).toEqual(['issf', 'silueta']);
    expect(roundTargets(TARGETS, 'viejo').map((target) => target.id)).toEqual([
      'issf',
      'silueta',
      'viejo',
    ]);
  });
});

describe('validateRound', () => {
  it('una ronda válida no tiene errores', () => {
    expect(validateRound(draft({ manualScore: '95' }), TARGETS)).toEqual({});
  });

  it('blanco, distancia y disparos obligatorios', () => {
    expect(validateRound(draft({ targetId: '', distance: ' ', shots: 0 }), TARGETS)).toEqual({
      targetId: 'Elegí el blanco',
      distance: 'Ingresá la distancia',
      shots: 'Ingresá entre 1 y 999 disparos',
    });
  });

  it('la distancia es un número mayor que 0 y de hasta 2000 m', () => {
    expect(validateRound(draft({ distance: 'abc' }), TARGETS).distance).toBe(
      'Ingresá una distancia válida',
    );
    expect(validateRound(draft({ distance: '0' }), TARGETS).distance).toBe(
      'Ingresá una distancia válida',
    );
    expect(validateRound(draft({ distance: '2001' }), TARGETS).distance).toBe(
      'La distancia puede ser de hasta 2000 m',
    );
    expect(validateRound(draft({ distance: '2000' }), TARGETS).distance).toBeUndefined();
  });

  it('el puntaje es entero y no supera disparos × zona más alta', () => {
    expect(validateRound(draft({ manualScore: '9,5' }), TARGETS).manualScore).toBe(
      'Ingresá un número entero, sin decimales',
    );
    expect(validateRound(draft({ manualScore: '101' }), TARGETS).manualScore).toBe(
      'El puntaje no puede superar el máximo (100)',
    );
    expect(validateRound(draft({ manualScore: '100' }), TARGETS).manualScore).toBeUndefined();
  });

  it('en un blanco sin zonas no hay máximo por zonas', () => {
    expect(
      validateRound(draft({ targetId: 'silueta', manualScore: '500' }), TARGETS).manualScore,
    ).toBeUndefined();
    expect(roundMaxScore(SILUETA, 10)).toBeNull();
    expect(roundMaxScore(ISSF, 15)).toBe(150);
  });

  it('comentarios de hasta 500 caracteres', () => {
    expect(validateRound(draft({ comments: 'a'.repeat(501) }), TARGETS).comments).toBe(
      'Los comentarios pueden tener hasta 500 caracteres',
    );
  });
});

describe('discardsAnalysis', () => {
  const analyzed = round({
    photo: 'users/ana/rounds/r1/a.jpg',
    score: 95,
    analysis: withGroup(40),
  });
  const same = { targetId: 'issf', photos: storedPhotos(['users/ana/rounds/r1/a.jpg']) };

  it('se conserva si no cambian la foto ni el blanco', () => {
    expect(discardsAnalysis(analyzed, same)).toBe(false);
  });

  it('se descarta si cambia la foto, se quita o cambia el blanco', () => {
    expect(
      discardsAnalysis(analyzed, { ...same, photos: [pendingPhoto(new Blob(), 'b.jpg', 'b')] }),
    ).toBe(true);
    expect(discardsAnalysis(analyzed, { ...same, photos: [] })).toBe(true);
    expect(discardsAnalysis(analyzed, { ...same, targetId: 'silueta' })).toBe(true);
  });

  it('nada que descartar en una ronda nueva o sin analizar', () => {
    expect(discardsAnalysis(undefined, { ...same, photos: [] })).toBe(false);
    expect(discardsAnalysis(round(), { ...same, photos: [] })).toBe(false);
  });
});

describe('rondas crudas', () => {
  const analysis = { calibration: { x: 1 }, impacts: [{ x: 0, y: 0 }], metrics: {} };
  const stored = [
    { id: 'r1', targetId: 'issf', shots: 10, score: 95, analysis },
    { id: 'r2', targetId: 'issf', shots: 5, score: null, analysis: null },
  ];
  const fields = roundFields(draft({ shots: 12, manualScore: '90' }), 'a.jpg');

  it('agrega una ronda nueva al final, sin análisis', () => {
    expect(saveRawRound(stored, 'r3', fields, true)).toEqual([
      ...stored,
      { id: 'r3', ...fields, score: null, analysis: null },
    ]);
  });

  it('al editar conserva el análisis completo (que la app no lee)', () => {
    const [first] = saveRawRound(stored, 'r1', fields, true);
    expect(first).toEqual({ id: 'r1', ...fields, score: 95, analysis });
  });

  it('al editar sin conservar el análisis borra el análisis y el puntaje calculado', () => {
    const [first] = saveRawRound(stored, 'r1', fields, false);
    expect(first).toMatchObject({ score: null, analysis: null, shots: 12 });
  });

  it('eliminar y deshacer vuelve a poner la ronda en su lugar, tal cual', () => {
    const { rounds, removed } = removeRawRound(stored, 'r1');
    expect(rounds.map((item) => item.id)).toEqual(['r2']);
    expect(removed).toEqual({ round: stored[0], index: 0 });
    expect(restoreRawRound(rounds, removed!)).toEqual(stored);
  });

  it('deshacer no duplica la ronda si ya volvió', () => {
    expect(restoreRawRound(stored, { round: stored[0]!, index: 0 })).toEqual(stored);
  });

  it('eliminar una ronda que no existe no cambia nada', () => {
    expect(removeRawRound(stored, 'x')).toEqual({ rounds: stored });
  });

  it('tolera rondas dañadas', () => {
    expect(rawRounds([null, 3, { id: 'r1' }])).toEqual([{}, {}, { id: 'r1' }]);
    expect(rawRounds(undefined)).toEqual([]);
  });
});

describe('roundItems', () => {
  it('numera las rondas, usa el puntaje confirmado si hay y marca las analizadas', () => {
    const items = roundItems(
      session({
        rounds: [
          round({ manualScore: 90, score: 95, analysis: withGroup(40) }),
          round({ id: 'r2', targetId: 'otro', manualScore: 80 }),
        ],
      }),
      TARGETS,
    );
    expect(
      items.map(({ number, targetLabel, score, analyzed }) => ({
        number,
        targetLabel,
        score,
        analyzed,
      })),
    ).toEqual([
      { number: 1, targetLabel: 'ISSF Pistola Precisión', score: 95, analyzed: true },
      { number: 2, targetLabel: 'Blanco desconocido', score: 80, analyzed: false },
    ]);
  });
});
