import type { Configuration, Firearm } from '@/lib/firearms';
import type { Ammunition, Range } from '@/lib/inventory';
import type { Session, SessionLookups } from '@/lib/sessions';
import type { Target } from '@/lib/targets';
import { useCollection, type CollectionState } from './use-collection';
import { useInventoryRepositories } from './use-inventory';
import { useSessionRepository } from './use-sessions';

export type SessionData =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      sessions: Session[];
      lookups: SessionLookups;
      firearms: Firearm[];
      configurations: Configuration[];
      ranges: Range[];
      ammunition: Ammunition[];
      targets: Target[];
    };

/**
 * Sesiones con lo que hace falta para mostrarlas: armas, configuraciones, polígonos, munición y
 * blancos (archivados incluidos, para el historial).
 */
export function useSessionData(): SessionData {
  const inventory = useInventoryRepositories();
  const sessions = useCollection(useSessionRepository());
  const firearms = useCollection(inventory.firearms);
  const configurations = useCollection(inventory.configurations);
  const ranges = useCollection(inventory.ranges);
  const ammunition = useCollection(inventory.ammunition);
  const targets = useCollection(inventory.targets);

  const states: CollectionState<unknown>[] = [
    sessions,
    firearms,
    configurations,
    ranges,
    ammunition,
    targets,
  ];
  if (states.some((state) => state.status === 'error')) return { status: 'error' };
  if (
    sessions.status !== 'ready' ||
    firearms.status !== 'ready' ||
    configurations.status !== 'ready' ||
    ranges.status !== 'ready' ||
    ammunition.status !== 'ready' ||
    targets.status !== 'ready'
  ) {
    return { status: 'loading' };
  }
  return {
    status: 'ready',
    sessions: sessions.items,
    lookups: {
      firearms: firearms.items,
      configurations: configurations.items,
      ranges: ranges.items,
      ammunition: ammunition.items,
    },
    firearms: firearms.items,
    configurations: configurations.items,
    ranges: ranges.items,
    ammunition: ammunition.items,
    targets: targets.items,
  };
}
