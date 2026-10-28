import { createContext, useContext, useEffect, useState } from 'react';
import type { PhotoRepository } from '@/data/photo-repository';
import type { PhotoDraft } from '@/lib/photos';

export const PhotoContext = createContext<PhotoRepository | null>(null);

export function usePhotoRepository(): PhotoRepository {
  const context = useContext(PhotoContext);
  if (!context) throw new Error('usePhotoRepository necesita un PhotoProvider');
  return context;
}

export type PhotoSrcState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; src: string };

// Las fotos pendientes se muestran desde memoria. La URL vive lo mismo que el `Blob`.
const previews = new WeakMap<Blob, string>();

function previewUrl(blob: Blob): string {
  let url = previews.get(blob);
  if (!url) {
    url = URL.createObjectURL(blob);
    previews.set(blob, url);
  }
  return url;
}

/** `src` para mostrar una foto: la URL de Storage si está guardada o la local si está pendiente. */
export function usePhotoSrc(photo: PhotoDraft): PhotoSrcState {
  const repository = usePhotoRepository();
  const path = photo.status === 'stored' ? photo.path : undefined;
  const [loaded, setLoaded] = useState<{ path: string; value: PhotoSrcState }>();

  useEffect(() => {
    if (!path) return;
    let active = true;
    repository.url(path).then(
      (src) => active && setLoaded({ path, value: { status: 'ready', src } }),
      () => active && setLoaded({ path, value: { status: 'error' } }),
    );
    return () => {
      active = false;
    };
  }, [path, repository]);

  if (photo.status === 'pending') return { status: 'ready', src: previewUrl(photo.blob) };
  return loaded?.path === path && loaded ? loaded.value : { status: 'loading' };
}
