import { Navigate, useParams } from 'react-router';
import { useInventoryOutlet } from '@/hooks/use-inventory';
import type { CollectionState } from '@/hooks/use-collection';
import { NEW_ITEM_SEGMENT, parseCategory, type Archivable } from '@/lib/inventory';
import { AmmunitionSheet } from './ammunition-sheet';
import { RangeSheet } from './range-sheet';

export type InventoryItemRouteProps = { segment: 'nueva' | 'nuevo' } | { segment: 'editar' };

type ItemLookup<T> = { status: 'loading' } | { status: 'missing' } | { status: 'found'; item?: T };

function lookup<T extends Archivable>(
  state: CollectionState<T>,
  id: string | undefined,
): ItemLookup<T> {
  if (!id) return { status: 'found' };
  if (state.status === 'loading') return { status: 'loading' };
  const item = state.status === 'ready' ? state.items.find((i) => i.id === id) : undefined;
  return item ? { status: 'found', item } : { status: 'missing' };
}

/**
 * Sheet de alta o edición sobre la lista (ruta hija de `/inventario/:categoria`). Si la URL no
 * corresponde a ningún elemento editable, vuelve a la lista.
 */
export function InventoryItemRoute(props: InventoryItemRouteProps) {
  const params = useParams();
  const category = parseCategory(params.category);
  const { ammunition, ranges, listPath } = useInventoryOutlet();
  const back = <Navigate to={listPath} replace />;
  const id = props.segment === 'editar' ? params.id : undefined;

  if (!category) return back;
  if (props.segment !== 'editar' && NEW_ITEM_SEGMENT[category] !== props.segment) return back;

  if (category === 'municiones') {
    const found = lookup(ammunition, id);
    if (found.status === 'loading') return null;
    return found.status === 'found' ? <AmmunitionSheet key={id} item={found.item} /> : back;
  }
  if (category === 'poligonos') {
    const found = lookup(ranges, id);
    if (found.status === 'loading') return null;
    return found.status === 'found' ? <RangeSheet key={id} item={found.item} /> : back;
  }
  return back;
}
