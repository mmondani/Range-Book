import type { ReactNode } from 'react';
import type { SessionRepository } from '@/data/session-repository';
import { SessionContext } from '@/hooks/use-sessions';

export interface SessionProviderProps {
  repository: SessionRepository;
  children: ReactNode;
}

/** Acceso a las sesiones del usuario. */
export function SessionProvider({ repository, children }: SessionProviderProps) {
  return <SessionContext.Provider value={repository}>{children}</SessionContext.Provider>;
}
