import { useContext, useEffect } from 'react';
import { useCurrentUser } from './use-auth';
import { SessionContext } from './use-sessions';

/** Usuarios ya migrados en esta ejecución de la app (o con la migración en curso). */
const migrated = new Set<string>();

/**
 * Reprocesa los análisis guardados del usuario (radio medio, ADR 0008) una vez después de
 * iniciar sesión, en segundo plano. Si falla (por ejemplo, sin conexión y sin caché), se
 * reintenta en el próximo inicio; mientras tanto, `parseAnalysis` calcula el radio medio al leer.
 */
export function useMetricsMigration() {
  const uid = useCurrentUser()?.uid;
  const repository = useContext(SessionContext);

  useEffect(() => {
    if (!uid || !repository || migrated.has(uid)) return;
    migrated.add(uid);
    repository.migrateMeanRadius(uid).catch((error: unknown) => {
      migrated.delete(uid);
      console.error('No se pudieron reprocesar los análisis guardados', error);
    });
  }, [uid, repository]);
}

/** Solo para tests: olvida qué usuarios se migraron. */
export function resetMetricsMigration() {
  migrated.clear();
}
