import { vi } from 'vitest';
import type { MantisTraceRepository } from '@/data/mantis-trace-repository';
import type { MantisTrace } from '@/lib/mantis';

/** Doble de las trayectorias de MantisX en memoria. */
export function createFakeMantisTraces(initial: Record<number, MantisTrace> = {}) {
  const items = new Map<number, MantisTrace>(
    Object.entries(initial).map(([pk, trace]) => [Number(pk), trace]),
  );
  const repository = {
    get: vi.fn(async (_uid: string, sessionPk: number) => items.get(sessionPk) ?? null),
    save: vi.fn(async (_uid: string, sessionPk: number, trace: MantisTrace) => {
      items.set(sessionPk, trace);
    }),
    remove: vi.fn(async (_uid: string, sessionPk: number) => {
      items.delete(sessionPk);
    }),
  } satisfies MantisTraceRepository;
  return { repository, items: () => items };
}
