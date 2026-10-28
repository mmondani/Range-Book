import { useEffect, useState } from 'react';
import type { Modification } from '@/lib/firearms';
import { useCurrentUser } from './use-auth';
import { useInventoryRepositories } from './use-inventory';

/**
 * Modificaciones de varias armas a la vez, en vivo (una suscripción por arma). `undefined`
 * mientras alguna todavía no cargó. Si una falla, esa arma queda sin modificaciones.
 */
export function useFirearmModifications(
  firearmIds: readonly string[],
): ReadonlyMap<string, Modification[]> | undefined {
  const uid = useCurrentUser()?.uid;
  const repositories = useInventoryRepositories();
  const ids = [...firearmIds].sort().join('/');
  // Si cambia el usuario, no se muestran los datos del anterior.
  const key = `${uid ?? ''}:${ids}`;
  const [state, setState] = useState<{ key: string; byFirearm: Map<string, Modification[]> }>();

  useEffect(() => {
    if (!uid) return;
    const firearms = ids ? ids.split('/') : [];
    const byFirearm = new Map<string, Modification[]>();
    const publish = () => {
      if (byFirearm.size === firearms.length) setState({ key, byFirearm: new Map(byFirearm) });
    };
    publish();
    const unsubscribes = firearms.map((id) =>
      repositories.modifications(id).subscribe(
        uid,
        (items) => {
          byFirearm.set(id, items);
          publish();
        },
        () => {
          byFirearm.set(id, []);
          publish();
        },
      ),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [uid, ids, key, repositories]);

  return state?.key === key ? state.byFirearm : undefined;
}
