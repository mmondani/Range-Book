import { vi } from 'vitest';
import type { InventoryRepositories, InventoryRepository } from '@/data/inventory-repository';
import type { Ammunition, AmmunitionInput, Archivable, Range, RangeInput } from '@/lib/inventory';

/** Doble de una colección del inventario en memoria, con avisos en vivo como `onSnapshot`. */
function createFakeCollection<T extends Archivable, I extends object>(
  initial: T[],
  prefix: string,
) {
  let items = [...initial];
  let next = 0;
  const listeners = new Set<(items: T[]) => void>();
  const emit = () => listeners.forEach((listener) => listener([...items]));

  const repository = {
    subscribe: vi.fn<InventoryRepository<T, I>['subscribe']>((_uid, onItems) => {
      listeners.add(onItems);
      onItems([...items]);
      return () => listeners.delete(onItems);
    }),
    create: vi.fn(async (_uid: string, input: I) => {
      items = [...items, { ...input, id: `${prefix}-${++next}`, archived: false } as unknown as T];
      emit();
    }),
    update: vi.fn(async (_uid: string, id: string, input: I) => {
      items = items.map((item) => (item.id === id ? { ...item, ...input } : item));
      emit();
    }),
    setArchived: vi.fn(async (_uid: string, id: string, archived: boolean) => {
      items = items.map((item) => (item.id === id ? { ...item, archived } : item));
      emit();
    }),
  } satisfies InventoryRepository<T, I>;

  return { repository, items: () => items };
}

export const MAGTECH: Ammunition = {
  id: 'magtech',
  brand: 'Magtech',
  model: '9mm FMJ 115gr',
  description: 'Encamisada, práctica',
  archived: false,
};

export const CCI: Ammunition = {
  id: 'cci',
  brand: 'CCI',
  model: 'Standard Velocity',
  description: '.22 LR · 40 gr',
  archived: false,
};

export const SELLIER: Ammunition = {
  id: 'sellier',
  brand: 'Sellier & Bellot',
  model: '9mm FMJ 124gr',
  description: '',
  archived: true,
};

export const NORTE: Range = {
  id: 'norte',
  name: 'Polígono Norte',
  address: 'Av. Siempreviva 742',
  archived: false,
};

export const ALAMOS: Range = {
  id: 'alamos',
  name: 'Club de Tiro Los Álamos',
  address: 'Ruta 2 km 40',
  archived: false,
};

export function createFakeInventory({
  ammunition = [MAGTECH, CCI, SELLIER],
  ranges = [NORTE, ALAMOS],
}: { ammunition?: Ammunition[]; ranges?: Range[] } = {}) {
  const ammo = createFakeCollection<Ammunition, AmmunitionInput>(ammunition, 'ammo');
  const rangeCollection = createFakeCollection<Range, RangeInput>(ranges, 'range');
  const repositories = {
    ammunition: ammo.repository,
    ranges: rangeCollection.repository,
  } satisfies InventoryRepositories;
  return { repositories, ammunition: ammo.items, ranges: rangeCollection.items };
}
