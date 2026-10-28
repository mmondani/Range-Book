import type { ReactNode } from 'react';
import type { InventoryRepositories } from '@/data/inventory-repository';
import { InventoryContext } from '@/hooks/use-inventory';

export interface InventoryProviderProps {
  repositories: InventoryRepositories;
  children: ReactNode;
}

/** Acceso a las colecciones del inventario (munición, polígonos y, más adelante, el resto). */
export function InventoryProvider({ repositories, children }: InventoryProviderProps) {
  return <InventoryContext.Provider value={repositories}>{children}</InventoryContext.Provider>;
}
