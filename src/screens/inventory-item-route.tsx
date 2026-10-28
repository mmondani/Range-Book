import { Navigate, useParams } from 'react-router';
import { useInventoryOutlet } from '@/hooks/use-inventory';
import type { CollectionState } from '@/hooks/use-collection';
import { NEW_ITEM_SEGMENT, parseCategory, type Archivable } from '@/lib/inventory';
import { AmmunitionSheet } from './ammunition-sheet';
import { ConfigurationSheet } from './configuration-sheet';
import { FirearmSheet } from './firearm-sheet';
import { RangeSheet } from './range-sheet';
import { TargetSheet } from './target-sheet';

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

function itemsOf<T>(state: CollectionState<T>): T[] {
  return state.status === 'ready' ? state.items : [];
}

/**
 * Sheet de alta o edición sobre la lista (ruta hija de `/inventario/:categoria`). Si la URL no
 * corresponde a ningún elemento editable, vuelve a la lista. Las armas se editan desde su detalle.
 */
export function InventoryItemRoute(props: InventoryItemRouteProps) {
  const params = useParams();
  const category = parseCategory(params.category);
  const { firearms, configurations, ammunition, ranges, targets, listPath } = useInventoryOutlet();
  const back = <Navigate to={listPath} replace />;
  const id = props.segment === 'editar' ? params.id : undefined;

  if (!category) return back;
  if (props.segment !== 'editar' && NEW_ITEM_SEGMENT[category] !== props.segment) return back;

  if (category === 'armas') {
    if (id) return <Navigate to={`/inventario/armas/${id}/editar`} replace />;
    if (firearms.status === 'loading') return null;
    return <FirearmSheet firearms={itemsOf(firearms)} />;
  }
  if (category === 'configuraciones') {
    const found = lookup(configurations, id);
    if (configurations.status === 'loading' || firearms.status === 'loading') return null;
    return found.status === 'found' ? (
      <ConfigurationSheet
        key={id}
        item={found.item}
        firearms={itemsOf(firearms)}
        configurations={itemsOf(configurations)}
      />
    ) : (
      back
    );
  }
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
  if (category === 'blancos') {
    const found = lookup(targets, id);
    if (found.status === 'loading') return null;
    return found.status === 'found' ? <TargetSheet key={id} item={found.item} /> : back;
  }
  return back;
}
