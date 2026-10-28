import { Crosshair } from 'lucide-react';
import { cx } from '@/lib/cx';
import {
  accumulatedShots,
  activeModificationCount,
  firearmName,
  type Configuration,
  type Firearm,
  type Modification,
  type SessionUsage,
} from '@/lib/firearms';
import { formatInteger } from '@/lib/format';
import { activeItems } from '@/lib/inventory';
import { Badge } from './badge';
import { CardLink } from './card-link';
import styles from './firearm-cards.module.css';
import { Photo } from './photo';
import { Tag } from './tag';

export interface FirearmCardsProps {
  firearms: Firearm[];
  /** Modificaciones por arma; mientras cargan, no se muestra el contador. */
  modifications?: ReadonlyMap<string, Modification[]>;
  configurations: readonly Configuration[];
  usage: readonly SessionUsage[];
  'aria-label': string;
}

function modificationsText(count: number): string {
  if (count === 0) return 'Sin modificaciones';
  return count === 1 ? '1 modificación' : `${formatInteger(count)} modificaciones`;
}

/** M08 / W06 · Armas: tarjetas con foto de portada, calibre, modificaciones y tiros acumulados. */
export function FirearmCards({
  firearms,
  modifications,
  configurations,
  usage,
  'aria-label': ariaLabel,
}: FirearmCardsProps) {
  return (
    <ul aria-label={ariaLabel} className={styles.grid}>
      {firearms.map((firearm) => {
        const name = firearmName(firearm);
        const cover = firearm.photos[0];
        const mods = modifications?.get(firearm.id);
        const configs = activeItems(configurations).filter((c) => c.firearmId === firearm.id);
        const shots = accumulatedShots(firearm, usage).total;
        return (
          <li key={firearm.id} className={cx(firearm.archived && styles.archived)}>
            <CardLink to={`/inventario/armas/${firearm.id}`} padded={false} className={styles.card}>
              <span className={styles.media}>
                {cover ? (
                  <Photo
                    photo={{ status: 'stored', path: cover }}
                    alt=""
                    className={styles.photo}
                  />
                ) : (
                  <span className={styles.placeholder} aria-hidden="true">
                    <Crosshair />
                  </span>
                )}
              </span>
              <span className={styles.body}>
                <span className={styles.heading}>
                  <span className={styles.name}>{name}</span>
                  <Tag className={styles.caliber}>{firearm.caliber}</Tag>
                </span>
                <span className={styles.meta}>
                  <span>
                    {mods && modificationsText(activeModificationCount(mods))}
                    {configs.length > 0 && (
                      <span className={styles.configs}>
                        {' · '}
                        {configs.length === 1 ? '1 config.' : `${configs.length} config.`}
                      </span>
                    )}
                  </span>
                  <span className={cx('num', styles.shots)}>
                    <b>{formatInteger(shots)}</b> tiros acumulados
                  </span>
                </span>
                {firearm.archived && <Badge className={styles.badge}>Archivada</Badge>}
              </span>
            </CardLink>
          </li>
        );
      })}
    </ul>
  );
}
