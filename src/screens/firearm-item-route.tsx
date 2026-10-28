import { Navigate, useOutletContext, useParams } from 'react-router';
import type { CollectionState } from '@/hooks/use-collection';
import type { Archivable } from '@/lib/inventory';
import { ConfigurationSheet } from './configuration-sheet';
import { FirearmSheet } from './firearm-sheet';
import type { FirearmOutletContext } from './firearm-screen';
import { ModificationSheet } from './modification-sheet';

export interface FirearmItemRouteProps {
  kind: 'firearm' | 'modification' | 'configuration';
  segment: 'nueva' | 'editar';
}

function find<T extends Archivable>(state: CollectionState<T>, id: string | undefined) {
  if (state.status === 'loading') return 'loading';
  return state.status === 'ready' ? state.items.find((item) => item.id === id) : undefined;
}

/**
 * Sheets sobre el detalle del arma (rutas hijas de `/inventario/armas/:id`): editar el arma, y
 * alta y edición de sus modificaciones y configuraciones. Si la URL no corresponde a nada, vuelve
 * al detalle.
 */
export function FirearmItemRoute({ kind, segment }: FirearmItemRouteProps) {
  const { itemId } = useParams();
  const { firearm, firearms, modifications, configurations, listPath } =
    useOutletContext<FirearmOutletContext>();
  const back = <Navigate to={listPath} replace />;

  if (kind === 'firearm') return <FirearmSheet item={firearm} firearms={firearms} />;

  if (kind === 'modification') {
    if (segment === 'nueva') return <ModificationSheet firearm={firearm} />;
    const item = find(modifications, itemId);
    if (item === 'loading') return null;
    return item ? <ModificationSheet key={item.id} firearm={firearm} item={item} /> : back;
  }

  if (configurations.status === 'loading') return null;
  const all = configurations.status === 'ready' ? configurations.items : [];
  if (segment === 'nueva') {
    return <ConfigurationSheet firearm={firearm} firearms={firearms} configurations={all} />;
  }
  const item = all.find(
    (configuration) => configuration.id === itemId && configuration.firearmId === firearm.id,
  );
  return item ? (
    <ConfigurationSheet key={item.id} item={item} firearms={firearms} configurations={all} />
  ) : (
    back
  );
}
