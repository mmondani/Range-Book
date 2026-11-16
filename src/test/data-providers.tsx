import type { ReactNode } from 'react';
import { InventoryProvider } from '@/components/inventory-provider';
import { MantisTraceProvider } from '@/components/mantis-trace-provider';
import { PhotoProvider } from '@/components/photo-provider';
import { SessionProvider } from '@/components/session-provider';
import { ToastProvider } from '@/components/toast-provider';
import { createFakeInventory } from './fake-inventory';
import { createFakeMantisTraces } from './fake-mantis-traces';
import { createFakePhotos } from './fake-photos';
import { createFakeSessions } from './fake-sessions';

/**
 * Fotos, inventario, sesiones y toasts simulados, para los tests que solo necesitan que las
 * pantallas de datos (por ejemplo, Sesiones al ingresar) se puedan montar.
 */
export function DataProviders({ children }: { children: ReactNode }) {
  return (
    <PhotoProvider repository={createFakePhotos().repository}>
      <InventoryProvider repositories={createFakeInventory().repositories}>
        <SessionProvider repository={createFakeSessions().repository}>
          <MantisTraceProvider repository={createFakeMantisTraces().repository}>
            <ToastProvider>{children}</ToastProvider>
          </MantisTraceProvider>
        </SessionProvider>
      </InventoryProvider>
    </PhotoProvider>
  );
}
