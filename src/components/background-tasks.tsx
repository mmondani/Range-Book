import { useEffect } from 'react';
import { useAppUpdate } from '@/hooks/use-app-update';
import { usePendingUploads } from '@/hooks/use-pending-uploads';
import { useToast } from '@/hooks/use-toast';

/** Sin UI propia: sube las fotos pendientes y avisa cuando hay una versión nueva de la app. */
export function BackgroundTasks() {
  usePendingUploads();
  const update = useAppUpdate();
  const toast = useToast();

  useEffect(() => {
    if (update) {
      toast.show({
        message: 'Hay una versión nueva',
        action: { label: 'Actualizar', onAction: update },
      });
    }
  }, [update, toast]);

  return null;
}
