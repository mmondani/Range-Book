import { createContext, useContext, useEffect, useState } from 'react';
import type { ProfileRepository } from '@/data/profile-repository';
import type { Profile } from '@/lib/auth';
import type { Preferences, ProfileSummary } from '@/lib/profile';
import { DEFAULT_UNITS, type Units } from '@/lib/units';

export interface ProfileContextValue {
  uid: string;
  repository: ProfileRepository;
  /** `undefined` mientras carga; `null` si el documento todavía no existe. */
  profile: Profile | null | undefined;
  /** El tema se aplica al instante; después se guarda en Firestore. */
  updatePreferences: (preferences: Partial<Preferences>) => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile necesita un ProfileProvider con sesión');
  return context;
}

/** Unidades en que se muestran las medidas; mm si todavía no cargó el perfil. */
export function useUnits(): Units {
  return useContext(ProfileContext)?.profile?.units ?? DEFAULT_UNITS;
}

export type SummaryState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; summary: ProfileSummary };

export function useProfileSummary(): SummaryState {
  const { uid, repository } = useProfile();
  const [state, setState] = useState<{ uid: string; value: SummaryState }>({
    uid,
    value: { status: 'loading' },
  });

  useEffect(
    () =>
      repository.subscribeSummary(
        uid,
        (summary) => setState({ uid, value: { status: 'ready', summary } }),
        () => setState({ uid, value: { status: 'error' } }),
      ),
    [uid, repository],
  );

  // Si cambia el usuario, no se muestra el resumen del anterior.
  return state.uid === uid ? state.value : { status: 'loading' };
}
