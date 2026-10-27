import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ProfileRepository } from '@/data/profile-repository';
import { useCurrentUser } from '@/hooks/use-auth';
import { ProfileContext } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import type { Profile } from '@/lib/auth';
import type { Preferences } from '@/lib/profile';

export interface ProfileProviderProps {
  repository: ProfileRepository;
  children: ReactNode;
}

/**
 * Perfil del usuario con sesión, en vivo. El tema guardado en Firestore manda: si cambia
 * (por ejemplo, desde otro dispositivo), se aplica y se copia a `localStorage`.
 */
export function ProfileProvider({ repository, children }: ProfileProviderProps) {
  const uid = useCurrentUser()?.uid;
  const { setPreference } = useTheme();
  const [loaded, setLoaded] = useState<{ uid: string; profile: Profile | null }>();
  const profile = uid && loaded?.uid === uid ? loaded.profile : undefined;

  useEffect(() => {
    if (!uid) return;
    return repository.subscribeProfile(
      uid,
      (next) => setLoaded({ uid, profile: next }),
      // Sin perfil se usan los valores locales; no bloquea el resto de la app.
      () => setLoaded({ uid, profile: null }),
    );
  }, [uid, repository]);

  const remoteTheme = profile?.theme;
  useEffect(() => {
    if (remoteTheme) setPreference(remoteTheme);
  }, [remoteTheme, setPreference]);

  const updatePreferences = useCallback(
    async (preferences: Partial<Preferences>) => {
      if (preferences.theme) setPreference(preferences.theme);
      if (uid) await repository.updatePreferences(uid, preferences);
    },
    [uid, repository, setPreference],
  );

  const value = useMemo(
    () => (uid ? { uid, repository, profile, updatePreferences } : null),
    [uid, repository, profile, updatePreferences],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
