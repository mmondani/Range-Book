import { useEffect } from 'react';
import { useCurrentUser } from './use-auth';
import { useOnline } from './use-online';
import { usePhotoRepository } from './use-photos';

/** Sube las fotos que quedaron pendientes al abrir la app y cada vez que vuelve la conexión. */
export function usePendingUploads(): void {
  const uid = useCurrentUser()?.uid;
  const online = useOnline();
  const photos = usePhotoRepository();

  useEffect(() => {
    if (uid && online) photos.syncPending(uid).catch(() => {});
  }, [uid, online, photos]);
}
