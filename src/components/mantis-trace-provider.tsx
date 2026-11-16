import type { ReactNode } from 'react';
import type { MantisTraceRepository } from '@/data/mantis-trace-repository';
import { MantisTraceContext } from '@/hooks/use-mantis';

export interface MantisTraceProviderProps {
  repository: MantisTraceRepository;
  children: ReactNode;
}

/** Acceso a las trayectorias de MantisX del usuario. */
export function MantisTraceProvider({ repository, children }: MantisTraceProviderProps) {
  return <MantisTraceContext.Provider value={repository}>{children}</MantisTraceContext.Provider>;
}
