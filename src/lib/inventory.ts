/** Categorías de M08 / W06, en el orden de las pestañas. Son el segmento de la URL. */
export const INVENTORY_CATEGORIES = [
  'armas',
  'configuraciones',
  'municiones',
  'poligonos',
  'blancos',
] as const;

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export function parseCategory(value: string | undefined): InventoryCategory | undefined {
  return INVENTORY_CATEGORIES.find((category) => category === value);
}

/** Segmento de la URL del alta: `/inventario/municiones/nueva`, `/inventario/poligonos/nuevo`. */
export const NEW_ITEM_SEGMENT: Record<InventoryCategory, 'nueva' | 'nuevo'> = {
  armas: 'nueva',
  configuraciones: 'nueva',
  municiones: 'nueva',
  poligonos: 'nuevo',
  blancos: 'nuevo',
};

/** Longitudes máximas; las reglas de Firestore exigen las mismas. */
export const NAME_MAX_LENGTH = 100;
export const TEXT_MAX_LENGTH = 500;

/** Entidad del inventario: no se borra, se archiva. */
export interface Archivable {
  id: string;
  archived: boolean;
}

export interface AmmunitionInput {
  brand: string;
  model: string;
  description: string;
}

export interface Ammunition extends AmmunitionInput, Archivable {}

export interface RangeInput {
  name: string;
  address: string;
}

export interface Range extends RangeInput, Archivable {}

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

const collator = new Intl.Collator('es-AR', { sensitivity: 'base', numeric: true });

export function ammunitionName({ brand, model }: AmmunitionInput): string {
  return [brand, model].filter(Boolean).join(' ');
}

export function rangeName({ name }: RangeInput): string {
  return name;
}

export function sortByName<T>(items: readonly T[], name: (item: T) => string): T[] {
  return [...items].sort((a, b) => collator.compare(name(a), name(b)));
}

export function activeItems<T extends Archivable>(items: readonly T[]): T[] {
  return items.filter((item) => !item.archived);
}

export function archivedItems<T extends Archivable>(items: readonly T[]): T[] {
  return items.filter((item) => item.archived);
}

/**
 * Lista del inventario: los activos ordenados por nombre y, si se piden, los archivados
 * al final (también ordenados).
 */
export function inventoryList<T extends Archivable>(
  items: readonly T[],
  name: (item: T) => string,
  showArchived: boolean,
): T[] {
  const active = sortByName(activeItems(items), name);
  return showArchived ? [...active, ...sortByName(archivedItems(items), name)] : active;
}

/**
 * Opciones de un select (sesión, ronda): solo los activos. Si el elemento ya elegido
 * se archivó después, se sigue ofreciendo para no perder el valor al editar.
 */
export function selectableItems<T extends Archivable>(
  items: readonly T[],
  name: (item: T) => string,
  selectedId?: string | null,
): T[] {
  return sortByName(
    items.filter((item) => !item.archived || item.id === selectedId),
    name,
  );
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-AR');
}

/** Búsqueda sin distinguir mayúsculas ni acentos: cada palabra tiene que aparecer en algún campo. */
export function matchesSearch(fields: readonly string[], query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const text = normalize(fields.join(' '));
  return words.every((word) => text.includes(word));
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function parseAmmunition(id: string, data: Record<string, unknown>): Ammunition {
  return {
    id,
    brand: text(data.brand),
    model: text(data.model),
    description: text(data.description),
    archived: data.archived === true,
  };
}

export function parseRange(id: string, data: Record<string, unknown>): Range {
  return {
    id,
    name: text(data.name),
    address: text(data.address),
    archived: data.archived === true,
  };
}

export function cleanAmmunition(input: AmmunitionInput): AmmunitionInput {
  return {
    brand: input.brand.trim(),
    model: input.model.trim(),
    description: input.description.trim(),
  };
}

export function cleanRange(input: RangeInput): RangeInput {
  return { name: input.name.trim(), address: input.address.trim() };
}

export function validateAmmunition(input: AmmunitionInput): FieldErrors<AmmunitionInput> {
  const { brand, model } = cleanAmmunition(input);
  const errors: FieldErrors<AmmunitionInput> = {};
  if (!brand) errors.brand = 'Ingresá la marca';
  if (!model) errors.model = 'Ingresá el modelo';
  return errors;
}

export function validateRange(input: RangeInput): FieldErrors<RangeInput> {
  const errors: FieldErrors<RangeInput> = {};
  if (!cleanRange(input).name) errors.name = 'Ingresá el nombre';
  return errors;
}

export function hasErrors<T>(errors: FieldErrors<T>): boolean {
  return Object.values(errors).some(Boolean);
}
