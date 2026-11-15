import { useEffect } from 'react';
import { useAppUpdate } from '@/hooks/use-app-update';
import { useMetricsMigration } from '@/hooks/use-metrics-migration';
import { usePendingUploads } from '@/hooks/use-pending-uploads';
import { useToast } from '@/hooks/use-toast';

/**
 * Sin UI propia: sube las fotos pendientes, reprocesa los análisis guardados y avisa cuando hay
 * una versión nueva de la app.
 */
export function BackgroundTasks() {
  usePendingUploads();
  useMetricsMigration();
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
