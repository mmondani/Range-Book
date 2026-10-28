import { ChevronRight, Pencil } from 'lucide-react';
import { Link } from 'react-router';
import { OPENED_FROM_LIST } from '@/hooks/use-inventory';
import { cx } from '@/lib/cx';
import { formatDecimal, formatInteger } from '@/lib/format';
import { storedPhotos } from '@/lib/photos';
import type { RoundItem } from '@/lib/rounds';
import { formatLength, type Units } from '@/lib/units';
import { Card } from './card';
import { IconLink } from './icon-link';
import { RoundStatus } from './round-status';
import { TargetThumb } from './target-thumb';
import styles from './round-row.module.css';

export interface RoundRowProps {
  item: RoundItem;
  units: Units;
  editPath: string;
  analysisPath: string;
}

/** Ronda en el detalle de la sesión (mobile): blanco, disparos, puntaje, grupo y estado. */
export function RoundRow({ item, units, editPath, analysisPath }: RoundRowProps) {
  const { round, number, target, targetLabel, score, analyzed } = item;
  const [photo] = storedPhotos(round.photo ? [round.photo] : []);
  const group = round.analysis?.metrics.groupSizeMm;
  // Se nombra la ronda para que cada link se distinga fuera de contexto.
  const analysisLabel = analyzed ? 'Ver análisis' : 'Analizar blanco';
  return (
    <Card className={styles.row}>
      <TargetThumb
        scoring={target?.scoring ?? 'rings'}
        zones={target?.zones ?? []}
        photo={photo}
        alt={`Foto del blanco de la ronda ${number}`}
        className={styles.thumb}
      />
      <div className={styles.body}>
        <div className={styles.top}>
          <span className={styles.title}>Ronda {number}</span>
          <RoundStatus analyzed={analyzed} />
        </div>
        <span className={cx('num', styles.data)}>
          {formatInteger(round.shots)} disparos
          {score !== null && ` · ${formatInteger(score)} pts`}
          {group != null && ` · ${formatLength(group, units)}`}
        </span>
        <span className={styles.meta}>
          {targetLabel} · {formatDecimal(round.distanceM)} m
          {round.comments && ` · ${round.comments}`}
        </span>
        <Link
          to={analysisPath}
          aria-label={`${analysisLabel} de la ronda ${number}`}
          className={styles.analysis}
        >
          {analysisLabel}
          <ChevronRight aria-hidden="true" size={18} />
        </Link>
      </div>
      <IconLink
        to={editPath}
        state={OPENED_FROM_LIST}
        aria-label={`Editar ronda ${number}`}
        className={styles.edit}
      >
        <Pencil aria-hidden="true" />
      </IconLink>
    </Card>
  );
}
