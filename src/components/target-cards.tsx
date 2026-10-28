import { RotateCcw } from 'lucide-react';
import type { To } from 'react-router';
import { OPENED_FROM_LIST } from '@/hooks/use-inventory';
import { cx } from '@/lib/cx';
import { targetName, targetSummary, type Target } from '@/lib/targets';
import { Badge } from './badge';
import { Button } from './button';
import { Card } from './card';
import { CardLink } from './card-link';
import styles from './target-cards.module.css';
import { TargetThumb } from './target-thumb';

export interface TargetCardsProps {
  targets: Target[];
  /** Edición del blanco (sheet sobre la lista). */
  editTo: (target: Target) => To;
  onRestore: (target: Target) => void;
  'aria-label': string;
}

function Content({ target }: { target: Target }) {
  return (
    <>
      <TargetThumb
        scoring={target.scoring}
        zones={target.zones}
        photo={target.photo ? { status: 'stored', path: target.photo } : undefined}
        className={styles.thumb}
      />
      <span className={styles.name}>{targetName(target)}</span>
      <span className={styles.summary}>{targetSummary(target)}</span>
    </>
  );
}

/**
 * M08 / W06 · Blancos: tarjetas con la foto (o el dibujo de las zonas), el nombre y el resumen
 * de la geometría. Un blanco activo se edita tocando la tarjeta; uno archivado se restaura.
 */
export function TargetCards({
  targets,
  editTo,
  onRestore,
  'aria-label': ariaLabel,
}: TargetCardsProps) {
  return (
    <ul aria-label={ariaLabel} className={styles.grid}>
      {targets.map((target) => {
        const name = targetName(target);
        return (
          <li key={target.id} className={cx(target.archived && styles.archived)}>
            {target.archived ? (
              <Card padded={false} className={styles.card}>
                <Content target={target} />
                <span className={styles.archivedActions}>
                  <Badge>Archivado</Badge>
                  <Button
                    variant="ghost"
                    aria-label={`Restaurar ${name}`}
                    onClick={() => onRestore(target)}
                  >
                    <RotateCcw aria-hidden="true" size={16} />
                    Restaurar
                  </Button>
                </span>
              </Card>
            ) : (
              <CardLink
                to={editTo(target)}
                state={OPENED_FROM_LIST}
                padded={false}
                aria-label={`Editar ${name}`}
                className={styles.card}
              >
                <Content target={target} />
              </CardLink>
            )}
          </li>
        );
      })}
    </ul>
  );
}
