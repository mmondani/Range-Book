import { Activity } from 'lucide-react';
import { Link } from 'react-router';
import { cx } from '@/lib/cx';
import type { MantisShot } from '@/lib/mantis';
import { mantisLinkLabel, mantisSummaryText } from '@/lib/mantis-trace';
import styles from './mantis-pill.module.css';

export interface MantisPillProps {
  shots: readonly MantisShot[];
  roundNumber: number;
  to: string;
  className?: string;
}

/** "MantisX 88,3 · 17,1 s" en la ronda (puntaje promedio · tiempo total): lleva a su pantalla. */
export function MantisPill({ shots, roundNumber, to, className }: MantisPillProps) {
  return (
    <Link
      to={to}
      aria-label={mantisLinkLabel(shots, roundNumber)}
      className={cx(styles.pill, className)}
    >
      <Activity aria-hidden="true" size={18} />
      <span className="num">MantisX {mantisSummaryText(shots)}</span>
    </Link>
  );
}
