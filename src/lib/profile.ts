import type { Profile } from '@/lib/auth';
import { parseThemePreference } from '@/lib/theme';
import { parseUnits } from '@/lib/units';

export type Preferences = Pick<Profile, 'units' | 'theme'>;

/** Resumen de M11: sesiones registradas, disparos en ellas y armas activas. */
export interface ProfileSummary {
  sessions: number;
  shots: number;
  firearms: number;
}

/** Lo mínimo de una sesión que necesita el resumen (el modelo completo llega en el paso 9). */
export interface SessionShots {
  rounds?: ReadonlyArray<{ shots?: unknown }>;
}

/** Lo mínimo de un arma que necesita el resumen (el modelo completo llega en el paso 7). */
export interface FirearmStatus {
  archived?: unknown;
}

/** Lee el documento `users/{uid}`; los valores inválidos o faltantes vuelven a los de defecto. */
export function parseProfile(data: Record<string, unknown>): Profile {
  return {
    displayName: typeof data.displayName === 'string' ? data.displayName : '',
    photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
    units: parseUnits(data.units),
    theme: parseThemePreference(data.theme),
  };
}

function shotsOf(session: SessionShots): number {
  return (session.rounds ?? []).reduce((total, round) => {
    const shots = typeof round.shots === 'number' && round.shots > 0 ? round.shots : 0;
    return total + shots;
  }, 0);
}

export function profileSummary(
  sessions: ReadonlyArray<SessionShots>,
  firearms: ReadonlyArray<FirearmStatus>,
): ProfileSummary {
  return {
    sessions: sessions.length,
    shots: sessions.reduce((total, session) => total + shotsOf(session), 0),
    firearms: firearms.filter((firearm) => firearm.archived !== true).length,
  };
}
