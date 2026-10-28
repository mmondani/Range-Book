import { vi } from 'vitest';
import type { SessionRepository } from '@/data/session-repository';
import type { RoundFields } from '@/lib/rounds';
import type { Round, Session, SessionFields } from '@/lib/sessions';

export const ROUND_1: Round = {
  id: 'r1',
  targetId: 'issf',
  distanceM: 25,
  shots: 15,
  manualScore: 136,
  score: null,
  photo: 'users/ana/rounds/r1/a.jpg',
  comments: 'Buen control del gatillo',
  analysis: { groupSizeMm: 46 },
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
