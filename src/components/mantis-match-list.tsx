import { TriangleAlert } from 'lucide-react';
import { useId } from 'react';
import { cx } from '@/lib/cx';
import { formatFixed, formatShortDate, formatTime } from '@/lib/format';
import type { RoundMantis } from '@/lib/mantis';
import {
  mantisShotsLabel,
  roundChoices,
  roundOptionLabel,
  shotsMismatch,
  type MantisMatching,
} from '@/lib/mantis-matching';
import { mantisStats } from '@/lib/mantis-trace';
import { sessionLabels, type Session, type SessionLookups } from '@/lib/sessions';
import { Card } from './card';
import { Select } from './select';
import styles from './mantis-match-list.module.css';

/** Valor de "No importar" en el select. */
const NONE = '';

type Assign = (pk: number, roundId: string | null) => void;

export interface MantisMatchListProps {
  matching: MantisMatching;
  summaries: ReadonlyMap<number, RoundMantis>;
  sessions: readonly Session[];
  lookups: SessionLookups;
  /** `table` en desktop (W09). */
  variant?: 'rows' | 'table';
  onAssign: Assign;
}

/**
 * Matching de la importación: una tarjeta por sesión de Range Book y, dentro, una fila por sesión
 * de MantisX con el select de la ronda. Las rondas elegidas en otra fila no aparecen en las demás.
 */
export function MantisMatchList({
  matching,
  summaries,
  sessions,
  lookups,
  variant = 'rows',
  onAssign,
}: MantisMatchListProps) {
  return (
    <div className={styles.list}>
      {matching.groups.map((group) => {
        const session = sessions.find((item) => item.id === group.sessionId);
        if (!session) return null;
        const rows = group.pks.flatMap((pk) => {
          const summary = summaries.get(pk);
          return summary ? [{ pk, summary }] : [];
        });
        return (
          <MatchGroup
            key={group.sessionId}
            session={session}
            rows={rows}
            matching={matching}
            lookups={lookups}
            variant={variant}
            onAssign={onAssign}
          />
        );
      })}
    </div>
  );
}

interface MatchGroupProps {
  session: Session;
  rows: { pk: number; summary: RoundMantis }[];
  matching: MantisMatching;
  lookups: SessionLookups;
  variant: 'rows' | 'table';
  onAssign: Assign;
}

function MatchGroup({ session, rows, matching, lookups, variant, onAssign }: MatchGroupProps) {
  const titleId = useId();
  const labels = sessionLabels(session, lookups);
  const roundCount = session.rounds.length === 1 ? '1 ronda' : `${session.rounds.length} rondas`;
  const select = (pk: number, summary: RoundMantis) => (
    <RoundSelect
      pk={pk}
      summary={summary}
      session={session}
      matching={matching}
      onAssign={onAssign}
      visibleLabel={variant === 'rows' ? 'Ronda' : undefined}
      label={`Ronda para la sesión de MantisX de las ${formatTime(summary.date)}`}
    />
  );

  return (
    <Card as="section" padded={false} aria-labelledby={titleId} className={styles.group}>
      <div className={cx(styles.header, variant === 'table' && styles.headerWide)}>
        <div className={styles.titles}>
          <span className="eyebrow">{formatShortDate(session.date)}</span>
          <h2 id={titleId} className={styles.title}>
            {labels.title}
          </h2>
        </div>
        <span className={styles.meta}>
          {labels.range} · {roundCount}
        </span>
      </div>
      {variant === 'table' ? (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Sesión de MantisX</th>
              <th scope="col">Disparos</th>
              <th scope="col">Puntaje</th>
              <th scope="col" className={styles.roundColumn}>
                Ronda de Range Book
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ pk, summary }) => (
              <tr key={pk}>
                <td className={cx('num', styles.time)}>{formatTime(summary.date)}</td>
                <td className="num">{summary.shots.length}</td>
                <td className="num">{formatFixed(mantisStats(summary.shots).averageScore, 1)}</td>
                <td>{select(pk, summary)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        rows.map(({ pk, summary }) => (
          <div key={pk} className={styles.row}>
            <div className={styles.rowTop}>
              <span className={cx('num', styles.time)}>MantisX {formatTime(summary.date)}</span>
              <span className={cx('num', styles.shots)}>{mantisShotsLabel(summary)}</span>
            </div>
            {select(pk, summary)}
          </div>
        ))
      )}
    </Card>
  );
}

interface RoundSelectProps {
  pk: number;
  summary: RoundMantis;
  session: Session;
  matching: MantisMatching;
  onAssign: Assign;
  /** Etiqueta visible (mobile); si no hay, `label` queda para lectores de pantalla. */
  visibleLabel?: string;
  label: string;
}

function RoundSelect({
  pk,
  summary,
  session,
  matching,
  onAssign,
  visibleLabel,
  label,
}: RoundSelectProps) {
  const id = useId();
  const warningId = `${id}-warning`;
  const value = matching.assignments[pk] ?? NONE;
  const choices = roundChoices(matching, session, pk);
  const chosen = choices.find((choice) => choice.round.id === value);
  const warning = chosen ? shotsMismatch(chosen.round, chosen.number, summary) : undefined;

  return (
    <div className={styles.field}>
      {visibleLabel && (
        <label htmlFor={id} className={styles.label}>
          {visibleLabel}
        </label>
      )}
      <Select
        id={id}
        value={value}
        aria-label={visibleLabel ? undefined : label}
        aria-describedby={warning ? warningId : undefined}
        onChange={(event) => onAssign(pk, event.target.value === NONE ? null : event.target.value)}
      >
        {choices.map(({ round, number }) => (
          <option key={round.id} value={round.id}>
            {roundOptionLabel(round, number)}
          </option>
        ))}
        <option value={NONE}>No importar</option>
      </Select>
      {warning && (
        <span id={warningId} className={styles.warning}>
          <TriangleAlert aria-hidden="true" size={18} />
          {warning}
        </span>
      )}
    </div>
  );
}
