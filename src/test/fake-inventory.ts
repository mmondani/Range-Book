import { vi } from 'vitest';
import type {
  InventoryRepositories,
  InventoryRepository,
  UsageSource,
} from '@/data/inventory-repository';
import type {
  Configuration,
  ConfigurationInput,
  Firearm,
  FirearmInput,
  Modification,
  ModificationInput,
  SessionUsage,
} from '@/lib/firearms';
import type { Ammunition, AmmunitionInput, Archivable, Range, RangeInput } from '@/lib/inventory';
import type { Target, TargetInput } from '@/lib/targets';

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
    newId: vi.fn(() => `${prefix}-${++next}`),
    create: vi.fn(async (_uid: string, input: I, id?: string) => {
      const newId = id ?? `${prefix}-${++next}`;
      items = [...items, { ...input, id: newId, archived: false } as unknown as T];
      emit();
      return newId;
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

export const ISSF: Target = {
  id: 'issf',
  name: 'ISSF Pistola Precisión',
  photo: null,
  scoring: 'rings',
  referenceSizeMm: 500,
  zones: Array.from({ length: 10 }, (_, index) => ({
    score: 10 - index,
    diameterMm: 50 * (index + 1),
  })),
  archived: false,
};

export const IPSC_CLASSIC: Target = {
  id: 'ipsc-classic',
  name: 'IPSC Classic',
  photo: 'users/ana/targets/ipsc-classic/a.jpg',
  scoring: 'none',
  referenceSizeMm: 460,
  zones: [],
  archived: false,
};

export const B8: Target = {
  id: 'b8',
  name: 'NRA B-8',
  photo: null,
  scoring: 'rings',
  referenceSizeMm: 140,
  zones: [
    { score: 10, diameterMm: 34 },
    { score: 9, diameterMm: 55 },
    { score: 8, diameterMm: 80 },
    { score: 7, diameterMm: 105 },
    { score: 6, diameterMm: 140 },
  ],
  archived: true,
};

export const GLOCK: Firearm = {
  id: 'glock',
  brand: 'Glock',
  model: '17 Gen5',
  caliber: '9×19 mm',
  purchaseDate: '2023-03-14',
  purchasePlace: 'Armería Centro',
  priorShots: 1200,
  photos: ['users/ana/firearms/glock/a.jpg', 'users/ana/firearms/glock/b.jpg'],
  archived: false,
};

export const RUGER: Firearm = {
  id: 'ruger',
  brand: 'Ruger',
  model: '10/22',
  caliber: '.22 LR',
  purchaseDate: null,
  purchasePlace: '',
  priorShots: 0,
  photos: [],
  archived: false,
};

export const BERSA: Firearm = {
  id: 'bersa',
  brand: 'Bersa',
  model: 'Thunder 380',
  caliber: '.380 ACP',
  purchaseDate: null,
  purchasePlace: '',
  priorShots: 300,
  photos: [],
  archived: true,
};

export const HOLOSUN: Modification = {
  id: 'holosun',
  brand: 'Holosun',
  model: '507C X2',
  comments: 'Red dot, 2/32 MOA',
  archived: false,
};

export const ZEV: Modification = {
  id: 'zev',
  brand: 'Zev',
  model: 'PRO Trigger',
  comments: 'Gatillo plano, 3,5 lb',
  archived: false,
};

export const TARAN: Modification = {
  id: 'taran',
  brand: 'Taran Tactical',
  model: 'Base +2',
  comments: '',
  archived: true,
};

export const IPSC: Configuration = {
  id: 'ipsc',
  name: 'Config. IPSC',
  firearmId: 'glock',
  modificationIds: ['holosun', 'zev'],
  archived: false,
};

export const NIGHT: Configuration = {
  id: 'night',
  name: 'Nocturna',
  firearmId: 'glock',
  modificationIds: ['holosun'],
  archived: true,
};

/** 2 sesiones con la Glock "Stock" (100 + 50 disparos) y 1 con "Config. IPSC" (60). */
export const USAGE: SessionUsage[] = [
  { firearmId: 'glock', configurationId: null, shots: 100 },
  { firearmId: 'glock', configurationId: null, shots: 50 },
  { firearmId: 'glock', configurationId: 'ipsc', shots: 60 },
  { firearmId: 'ruger', configurationId: null, shots: 40 },
];

export function createFakeInventory({
  firearms = [GLOCK, RUGER, BERSA],
  modifications = { glock: [HOLOSUN, ZEV, TARAN] },
  configurations = [IPSC, NIGHT],
  ammunition = [MAGTECH, CCI, SELLIER],
  ranges = [NORTE, ALAMOS],
  targets = [ISSF, IPSC_CLASSIC, B8],
  usage = USAGE,
}: {
  firearms?: Firearm[];
  modifications?: Record<string, Modification[]>;
  configurations?: Configuration[];
  ammunition?: Ammunition[];
  ranges?: Range[];
  targets?: Target[];
  usage?: SessionUsage[];
} = {}) {
  const firearmCollection = createFakeCollection<Firearm, FirearmInput>(firearms, 'firearm');
  const modificationCollections = new Map<
    string,
    ReturnType<typeof createFakeCollection<Modification, ModificationInput>>
  >();
  const modificationsOf = (firearmId: string) => {
    let collection = modificationCollections.get(firearmId);
    if (!collection) {
      collection = createFakeCollection<Modification, ModificationInput>(
        modifications[firearmId] ?? [],
        `${firearmId}-mod`,
      );
      modificationCollections.set(firearmId, collection);
    }
    return collection;
  };
  const configurationCollection = createFakeCollection<Configuration, ConfigurationInput>(
    configurations,
    'config',
  );
  const ammo = createFakeCollection<Ammunition, AmmunitionInput>(ammunition, 'ammo');
  const rangeCollection = createFakeCollection<Range, RangeInput>(ranges, 'range');
  const targetCollection = createFakeCollection<Target, TargetInput>(targets, 'target');
  const usageSource = {
    subscribe: vi.fn<UsageSource['subscribe']>((_uid, onItems) => {
      onItems([...usage]);
      return () => {};
    }),
  } satisfies UsageSource;

  const repositories = {
    firearms: firearmCollection.repository,
    modifications: (firearmId: string) => modificationsOf(firearmId).repository,
    configurations: configurationCollection.repository,
    ammunition: ammo.repository,
    ranges: rangeCollection.repository,
    targets: targetCollection.repository,
    usage: usageSource,
  } satisfies InventoryRepositories;
  return {
    repositories,
    firearms: firearmCollection.items,
    modifications: (firearmId: string) => modificationsOf(firearmId).items(),
    configurations: configurationCollection.items,
    ammunition: ammo.items,
    ranges: rangeCollection.items,
    targets: targetCollection.items,
  };
}
