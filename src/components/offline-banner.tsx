import { WifiOff } from 'lucide-react';
import { useOnline } from '@/hooks/use-online';
import styles from './offline-banner.module.css';

/** Aviso fijo arriba de la pantalla mientras no hay conexión. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className={styles.banner}>
      <WifiOff aria-hidden="true" size={18} className={styles.icon} />
      <span>
        <strong>Sin conexión</strong> — los cambios se guardan y se sincronizan al volver
      </span>
    </div>
  );
}
