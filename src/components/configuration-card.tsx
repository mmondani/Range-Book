import { Pencil, RotateCcw } from 'lucide-react';
import { cx } from '@/lib/cx';
import type { FirearmConfiguration, Modification } from '@/lib/firearms';
import { formatInteger } from '@/lib/format';
import { Badge } from './badge';
import { Button } from './button';
import styles from './configuration-card.module.css';
import { IconButton } from './icon-button';
import { ModificationTags } from './modification-tags';

export interface ConfigurationCardProps {
  configuration: FirearmConfiguration;
  /** Modificaciones incluidas, ya resueltas. */
  modifications: readonly Modification[];
  sessions: number;
  onEdit?: () => void;
  onRestore?: () => void;
}

function sessionsText(count: number): string {
  return count === 1 ? '1 sesión' : `${formatInteger(count)} sesiones`;
}

/** M09 / W07 · Una configuración del arma: nombre, sesiones y modificaciones incluidas. */
export function ConfigurationCard({
  configuration,
  modifications,
  sessions,
  onEdit,
  onRestore,
}: ConfigurationCardProps) {
  const saved = configuration.kind === 'saved';
  const archived = saved && configuration.archived;
  return (
    <li className={cx(styles.card, saved && styles.saved, archived && styles.archived)}>
      <div className={styles.header}>
        <span className={styles.name}>{configuration.name}</span>
        <span className={cx('num', styles.sessions)}>{sessionsText(sessions)}</span>
        {saved && !archived && onEdit && (
          <IconButton aria-label={`Editar ${configuration.name}`} onClick={onEdit}>
            <Pencil aria-hidden="true" size={20} />
          </IconButton>
        )}
      </div>
      {saved ? (
        <ModificationTags
          aria-label={`Modificaciones de ${configuration.name}`}
          modifications={modifications}
        />
      ) : (
        <span className={styles.detail}>Sin modificaciones</span>
      )}
      {archived && (
        <div className={styles.archivedRow}>
          <Badge>Archivada</Badge>
          {onRestore && (
            <Button
              variant="ghost"
              aria-label={`Restaurar ${configuration.name}`}
              onClick={onRestore}
            >
              <RotateCcw aria-hidden="true" size={18} />
              Restaurar
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
