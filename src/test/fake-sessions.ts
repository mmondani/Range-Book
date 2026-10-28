import { vi } from 'vitest';
import type { SessionRepository } from '@/data/session-repository';
import type { AnalysisResult, RoundAnalysis } from '@/lib/analysis';
import type { RoundFields } from '@/lib/rounds';
import type { Round, Session, SessionFields } from '@/lib/sessions';

/**
 * Análisis de ROUND_1 sobre el ISSF (Ø 500 mm, foto de 1000 × 1000 px con el anillo exterior a
 * 250 px del centro: 1 mm por px). Tres impactos: dos de 10 y uno de 9, con un grupo de 46 mm.
 */
export const ROUND_1_ANALYSIS: RoundAnalysis = {
  calibration: {
    kind: 'ring',
    width: 1000,
    height: 1000,
    center: { x: 500, y: 500 },
    edge: { x: 750, y: 500 },
    diameterMm: 500,
  },
  impacts: [
    { x: 0, y: 10 },
    { x: 0, y: -36 },
    { x: -20, y: -13 },
  ],
  metrics: {
    impacts: 3,
    score: 29,
    maxScore: 30,
    averageScore: 29 / 3,
    distribution: [
      { score: 10, count: 2 },
      { score: 9, count: 1 },
    ],
    groupSizeMm: 46,
    groupSizeMoa: 46 / (25 * 0.2909),
    mpi: { x: -20 / 3, y: -13 },
    mpiOffsetMm: Math.hypot(20 / 3, 13),
    mpiClock: 7,
    meanDistanceMm: (10 + 36 + Math.hypot(20, 13)) / 3,
  },
  scoreConfirmed: false,
};

export const ROUND_1: Round = {
  id: 'r1',
  targetId: 'issf',
  distanceM: 25,
  shots: 15,
  manualScore: 136,
  score: null,
  photo: 'users/ana/rounds/r1/a.jpg',
  comments: 'Buen control del gatillo',
  analysis: ROUND_1_ANALYSIS,
};

export const ROUND_2: Round = {
  id: 'r2',
  targetId: 'issf',
  distanceM: 25,
  shots: 15,
  manualScore: 131,
  score: null,
  photo: null,
  comments: '',
  analysis: null,
};

/** Hoy (ver `TODAY`), con "Config. IPSC" y dos rondas. */
export const TODAY_SESSION: Session = {
  id: 'hoy',
  date: '2026-10-28',
  firearmId: 'glock',
  configurationId: 'ipsc',
  modificationsSnapshot: [
    { brand: 'Holosun', model: '507C X2' },
    { brand: 'Zev', model: 'PRO Trigger' },
  ],
  rangeId: 'norte',
  weather: 'sunny',
  ammunitionId: 'magtech',
  photos: ['users/ana/sessions/hoy/a.jpg', 'users/ana/sessions/hoy/b.jpg'],
  notes: 'Práctica de dobles a 7 m.',
  rounds: [ROUND_1, ROUND_2],
};

export const RUGER_SESSION: Session = {
  id: 'ruger-oct',
  date: '2026-10-11',
  firearmId: 'ruger',
  configurationId: null,
  modificationsSnapshot: [],
  rangeId: 'alamos',
  weather: 'cloudy',
  ammunitionId: 'cci',
  photos: [],
  notes: '',
  rounds: [{ ...ROUND_2, id: 'r3', shots: 10, manualScore: 96 }],
};

export const SEPTEMBER_SESSION: Session = {
  id: 'sep',
  date: '2026-09-27',
  firearmId: 'glock',
  configurationId: null,
  modificationsSnapshot: [],
  rangeId: 'norte',
  weather: 'rainy',
  ammunitionId: 'magtech',
  photos: [],
  notes: 'Lluvia fuerte',
  rounds: [],
};

/** Fecha de "hoy" en los tests de pantalla. */
export const TODAY = new Date(2026, 9, 28, 10, 0, 0);

/** Doble de las sesiones en memoria, con avisos en vivo como `onSnapshot`. */
export function createFakeSessions(
  initial: Session[] = [TODAY_SESSION, RUGER_SESSION, SEPTEMBER_SESSION],
) {
  let items = [...initial];
  let next = 0;
  const listeners = new Set<(items: Session[]) => void>();
  const emit = () => listeners.forEach((listener) => listener([...items]));
  const setRounds = (sessionId: string, change: (rounds: Round[]) => Round[]) => {
    items = items.map((item) =>
      item.id === sessionId ? { ...item, rounds: change(item.rounds) } : item,
    );
    emit();
  };

  const repository = {
    subscribe: vi.fn<SessionRepository['subscribe']>((_uid, onItems) => {
      listeners.add(onItems);
      onItems([...items]);
      return () => listeners.delete(onItems);
    }),
    newId: vi.fn(() => `session-${++next}`),
    create: vi.fn(async (_uid: string, id: string, fields: SessionFields) => {
      items = [...items, { ...fields, id, rounds: [] }];
      emit();
    }),
    update: vi.fn(async (_uid: string, id: string, fields: SessionFields) => {
      items = items.map((item) => (item.id === id ? { ...item, ...fields } : item));
      emit();
    }),
    remove: vi.fn(async (_uid: string, id: string) => {
      const removed = items.find((item) => item.id === id);
      items = items.filter((item) => item.id !== id);
      emit();
      return {
        undo: async () => {
          if (removed) items = [...items, removed];
          emit();
        },
      };
    }),
    saveRound: vi.fn(
      async (
        _uid: string,
        sessionId: string,
        roundId: string,
        fields: RoundFields,
        keepAnalysis: boolean,
      ) => {
        setRounds(sessionId, (rounds) =>
          rounds.some((round) => round.id === roundId)
            ? rounds.map((round) =>
                round.id === roundId
                  ? {
                      ...round,
                      ...fields,
                      ...(keepAnalysis ? {} : { score: null, analysis: null }),
                    }
                  : round,
              )
            : [...rounds, { id: roundId, ...fields, score: null, analysis: null }],
        );
      },
    ),
    saveAnalysis: vi.fn(
      async (_uid: string, sessionId: string, roundId: string, result: AnalysisResult) => {
        setRounds(sessionId, (rounds) =>
          rounds.map((round) =>
            round.id === roundId
              ? { ...round, analysis: result.analysis, score: result.score }
              : round,
          ),
        );
      },
    ),
    removeRound: vi.fn(async (_uid: string, sessionId: string, roundId: string) => {
      const rounds = items.find((item) => item.id === sessionId)?.rounds ?? [];
      const index = rounds.findIndex((round) => round.id === roundId);
      const removed = rounds[index];
      setRounds(sessionId, (current) => current.filter((round) => round.id !== roundId));
      return {
        undo: async () => {
          if (!removed) return;
          setRounds(sessionId, (current) => {
            const next = [...current];
            next.splice(index, 0, removed);
            return next;
          });
        },
      };
    }),
  } satisfies SessionRepository;

  return { repository, items: () => items };
}
