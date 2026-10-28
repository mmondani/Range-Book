import { useEffect, useState } from 'react';
import { useCurrentUser } from './use-auth';

export type CollectionState<T> =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: T[] };

export interface CollectionSource<T> {
  subscribe(
    uid: string,
    onItems: (items: T[]) => void,
    onError: (error: unknown) => void,
  ): () => void;
}

/** Elementos de una colección del usuario con sesión, en vivo. */
export function useCollection<T>(source: CollectionSource<T>): CollectionState<T> {
  const uid = useCurrentUser()?.uid;
  const [state, setState] = useState<{
    uid: string;
    source: CollectionSource<T>;
    value: CollectionState<T>;
  }>();

  useEffect(() => {
    if (!uid) return;
    return source.subscribe(
      uid,
      (items) => setState({ uid, source, value: { status: 'ready', items } }),
      () => setState({ uid, source, value: { status: 'error' } }),
    );
  }, [uid, source]);

  // Si cambia el usuario, no se muestran los datos del anterior.
  return state && state.uid === uid && state.source === source
    ? state.value
    : { status: 'loading' };
}
