import { describe, expect, it } from 'vitest';
import type { Firearm } from './firearms';
import type { MantisShot, RoundMantis } from './mantis';
import {
  assignRound,
  importedText,
  mantisSessionLabel,
  matchedImports,
  omittedNote,
  roundOptionLabel,
  skipReasonText,
  proposeMatching,
  roundChoices,
  shotsMismatch,
} from './mantis-matching';
import type { Round, Session } from './sessions';

/** Instante ISO de una hora local del 15/11/2026 (los tests no dependen de la zona horaria). */
const at = (hours: number, minutes: number, day = 15) =>
  new Date(2026, 10, day, hours, minutes).toISOString();

const shot = (pk: number): MantisShot => ({
  pk,
  score: 90,
  split: 3,
  problem: 'GREAT SHOT',
  angle: 0,
  triggerHold: 0.1,
  triggerPull: 0.1,
  cant: null,
});

const summary = (
  sessionPk: number,
  date: string,
  shots = 5,
  firearm = { make: 'Glock', model: 'G17', caliber: '9x19mm' },
): RoundMantis => ({
  sessionPk,
  date,
  hardware: 'X10',
  rightHanded: false,
  firearm,
  distance: { value: 6, metric: false },
  shots: Array.from({ length: shots }, (_, index) => shot(sessionPk * 100 + index)),
});

const round = (id: string, createdAt: string | null, overrides: Partial<Round> = {}): Round => ({
  id,
  targetId: 'issf',
  distanceM: 5.5,
  shots: 5,
  manualScore: null,
  score: null,
  photo: null,
  comments: '',
  analysis: null,
  createdAt,
  mantis: null,
  ...overrides,
});

const session = (id: string, rounds: Round[], overrides: Partial<Session> = {}): Session => ({
  id,
  date: '2026-11-15',
  firearmId: 'glock',
  configurationId: null,
  modificationsSnapshot: [],
  rangeId: 'norte',
  weather: null,
  ammunitionId: 'magtech',
  photos: [],
  notes: '',
  rounds,
  ...overrides,
});

const firearm = (id: string, brand: string, model: string): Firearm => ({
  id,
  brand,
  model,
  caliber: '9×19 mm',
  purchaseDate: null,
  purchasePlace: '',
  priorShots: 0,
  photos: [],
  archived: false,
});

const FIREARMS = [firearm('glock', 'Glock', '17 Gen5'), firearm('cz', 'CZ', 'Shadow 2')];

describe('proposeMatching', () => {
  it('propone la sesión del mismo día y la ronda más cercana en hora, respetando el orden', () => {
    const today = session('hoy', [
      round('r1', at(10, 8)),
      round('r2', at(10, 11)),
      round('r3', at(10, 15)),
    ]);
    const matching = proposeMatching(
      [summary(3, at(10, 14)), summary(1, at(10, 7))],
      [today],
      FIREARMS,
    );
    expect(matching.groups).toEqual([{ sessionId: 'hoy', pks: [1, 3] }]);
    expect(matching.assignments).toEqual({ 1: 'r1', 3: 'r3' });
    expect(matching.skipped).toEqual([]);
  });

  it('sin hora en las rondas (anteriores a esta iteración) asigna por orden', () => {
    const old = session('vieja', [round('r1', null), round('r2', null), round('r3', null)]);
    const matching = proposeMatching(
      [summary(1, at(10, 7)), summary(2, at(10, 9))],
      [old],
      FIREARMS,
    );
    expect(matching.assignments).toEqual({ 1: 'r1', 2: 'r2' });
  });

  it('con más sesiones de MantisX que rondas, las que sobran no se importan', () => {
    const today = session('hoy', [round('r1', at(10, 8)), round('r2', at(10, 20))]);
    const matching = proposeMatching(
      [summary(1, at(10, 7)), summary(2, at(10, 12)), summary(3, at(10, 19))],
      [today],
      FIREARMS,
    );
    expect(matching.assignments).toEqual({ 1: 'r1', 3: 'r2' });
    expect(matching.skipped).toEqual([{ pk: 2, reason: { kind: 'no-round', sessionId: 'hoy' } }]);
  });

  it('sin sesión de Range Book ese día, no se importa y dice el día', () => {
    const matching = proposeMatching(
      [summary(1, at(16, 40, 1))],
      [session('hoy', [round('r1', null)])],
      FIREARMS,
    );
    expect(matching.groups).toEqual([]);
    expect(matching.skipped).toEqual([
      { pk: 1, reason: { kind: 'no-session', date: '2026-11-01' } },
    ]);
  });

  it('con varias sesiones el mismo día, elige la del arma de MantisX', () => {
    const cz = session('cz-hoy', [round('c1', null)], { firearmId: 'cz' });
    const glock = session('glock-hoy', [round('g1', null)], { firearmId: 'glock' });
    const matching = proposeMatching(
      [
        summary(1, at(10, 7)),
        summary(2, at(11, 0), 5, { make: 'CZ', model: 'Shadow 2', caliber: '9mm' }),
      ],
      [cz, glock],
      FIREARMS,
    );
    expect(matching.assignments).toEqual({ 1: 'g1', 2: 'c1' });
  });

  it('marca las ya importadas y no les propone otra ronda', () => {
    const imported = round('r1', at(10, 8), { mantis: summary(1, at(10, 7)) });
    const today = session('hoy', [imported, round('r2', at(10, 11))]);
    const matching = proposeMatching(
      [summary(1, at(10, 7)), summary(2, at(10, 9))],
      [today],
      FIREARMS,
    );
    expect(matching.imported).toEqual([{ pk: 1, sessionId: 'hoy', roundId: 'r1', roundNumber: 1 }]);
    expect(matching.assignments).toEqual({ 2: 'r2' });
  });

  it('no importa una sesión con demasiados disparos', () => {
    const matching = proposeMatching(
      [summary(1, at(10, 7), 151)],
      [session('hoy', [round('r1', null)])],
      FIREARMS,
    );
    expect(matching.skipped).toEqual([{ pk: 1, reason: { kind: 'too-many-shots' } }]);
  });
});

describe('edición del matching', () => {
  const today = session('hoy', [
    round('r1', at(10, 8)),
    round('r2', at(10, 11)),
    round('r3', at(10, 15)),
  ]);
  const matching = proposeMatching(
    [summary(1, at(10, 7)), summary(2, at(10, 10))],
    [today],
    FIREARMS,
  );

  it('las opciones de cada fila no incluyen las rondas elegidas en las demás', () => {
    expect(roundChoices(matching, today, 1).map((item) => item.round.id)).toEqual(['r1', 'r3']);
    expect(roundChoices(matching, today, 2).map((item) => item.number)).toEqual([2, 3]);
  });

  it('elegir una ronda ya elegida la saca de la otra fila: no se repiten', () => {
    const changed = assignRound(matching, 1, 'r2');
    expect(changed.assignments).toEqual({ 1: 'r2', 2: null });
    expect(matchedImports(changed)).toEqual([{ sessionId: 'hoy', roundId: 'r2', pk: 1 }]);
  });

  it('"No importar" deja la sesión de MantisX afuera', () => {
    const changed = assignRound(matching, 2, null);
    expect(matchedImports(changed)).toEqual([{ sessionId: 'hoy', roundId: 'r1', pk: 1 }]);
  });
});

describe('shotsMismatch', () => {
  it('avisa si los disparos no coinciden', () => {
    expect(shotsMismatch({ shots: 10 }, 4, summary(1, at(10, 0)))).toBe(
      'La ronda 4 tiene 10 disparos y MantisX registró 5.',
    );
    expect(shotsMismatch({ shots: 5 }, 4, summary(1, at(10, 0)))).toBeUndefined();
  });
});

describe('textos de la revisión', () => {
  it('describen las sesiones de MantisX, las opciones y los motivos', () => {
    expect(mantisSessionLabel(summary(1, at(10, 25), 4))).toBe(
      'Dom 15 nov · 10:25 · 4 disparos · 90,0',
    );
    expect(roundOptionLabel(round('r1', at(10, 8)), 1)).toBe('Ronda 1 · 10:08 · 5 disparos');
    expect(roundOptionLabel(round('r1', null, { shots: 1 }), 2)).toBe('Ronda 2 · 1 disparo');
    expect(skipReasonText({ kind: 'no-session', date: '2026-10-31' })).toBe(
      'No hay ninguna sesión de Range Book el 31/10.',
    );
    expect(skipReasonText({ kind: 'no-round', sessionId: 'hoy' })).toBe(
      'No queda ninguna ronda disponible en esa sesión.',
    );
    expect(
      importedText({ pk: 1, sessionId: 'hoy', roundId: 'r1', roundNumber: 1 }, [
        session('hoy', [], { date: '2026-10-25' }),
      ]),
    ).toBe('En la ronda 1 de la sesión del 25/10.');
  });

  it('resume los entrenamientos omitidos', () => {
    expect(omittedNote({ count: 0, trainings: [] })).toBeUndefined();
    expect(omittedNote({ count: 5, trainings: ['tiro en seco', 'Holster Draw Analysis'] })).toBe(
      'Se omitieron 5 sesiones de otros entrenamientos (tiro en seco y Holster Draw Analysis): por ahora solo se importa fuego real de «Open Training».',
    );
    expect(omittedNote({ count: 1, trainings: ['tiro en seco'] })).toMatch(
      /^Se omitió 1 sesión de otro entrenamiento \(tiro en seco\)/,
    );
  });
});
