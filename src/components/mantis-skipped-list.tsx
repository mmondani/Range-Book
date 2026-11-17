import { ChevronDown } from 'lucide-react';
import { useId } from 'react';
import { cx } from '@/lib/cx';
import { formatFixed, formatTime, formatWeekdayDayMonth } from '@/lib/format';
import type { RoundMantis } from '@/lib/mantis';
import {
  importedText,
  mantisLocalDate,
  mantisSessionLabel,
  skipReasonText,
  type MantisMatching,
} from '@/lib/mantis-matching';
import { mantisStats } from '@/lib/mantis-trace';
import type { Session } from '@/lib/sessions';
import { Card } from './card';
import styles from './mantis-skipped-list.module.css';

export interface MantisSkippedListProps {
  matching: MantisMatching;
  summaries: ReadonlyMap<number, RoundMantis>;
  sessions: readonly Session[];
  /** `table` en desktop (W09). */
  variant?: 'rows' | 'table';
}

/**
 * Lo que no entra en la importación: "No se importan" (cada sesión de MantisX con su motivo) y
 * "Ya importadas" (desplegable cerrado, con la ronda donde está cada una).
 */
export function MantisSkippedList({
  matching,
  summaries,
  sessions,
  variant = 'rows',
}: MantisSkippedListProps) {
  const titleId = useId();
  const skipped = matching.skipped.flatMap((item) => {
    const summary = summaries.get(item.pk);
    return summary ? [{ ...item, summary }] : [];
  });
  const imported = matching.imported.flatMap((item) => {
    const summary = summaries.get(item.pk);
    return summary ? [{ ...item, summary }] : [];
  });

  return (
    <>
      {skipped.length > 0 && (
        <Card as="section" padded={false} aria-labelledby={titleId} className={styles.card}>
          <div className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              No se importan <span className={cx('num', styles.count)}>{skipped.length}</span>
            </h2>
            <span className={styles.meta}>
              Para importarlas, cargá la sesión o la ronda en Range Book y volvé a elegir el
              archivo.
            </span>
          </div>
          {variant === 'table' ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Sesión de MantisX</th>
                  <th scope="col">Disparos</th>
                  <th scope="col">Puntaje</th>
                  <th scope="col">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {skipped.map(({ pk, summary, reason }) => (
                  <tr key={pk}>
                    <td className="num">
                      {formatWeekdayDayMonth(mantisLocalDate(summary))} · {formatTime(summary.date)}
                    </td>
                    <td className="num">{summary.shots.length}</td>
                    <td className="num">
                      {formatFixed(mantisStats(summary.shots).averageScore, 1)}
                    </td>
                    <td>{skipReasonText(reason)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <ul className={styles.items}>
              {skipped.map(({ pk, summary, reason }) => (
                <li key={pk} className={styles.item}>
                  <span className={cx('num', styles.label)}>{mantisSessionLabel(summary)}</span>
                  <span className={styles.reason}>{skipReasonText(reason)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {imported.length > 0 && (
        <Card padded={false} className={styles.card}>
          <details className={styles.details}>
            <summary className={styles.summary}>
              <span>
                Ya importadas <span className={cx('num', styles.count)}>{imported.length}</span>
              </span>
              <ChevronDown aria-hidden="true" size={18} className={styles.chevron} />
            </summary>
            <ul className={styles.items}>
              {imported.map((item) => (
                <li key={item.pk} className={styles.item}>
                  <span className={cx('num', styles.label)}>
                    {mantisSessionLabel(item.summary)}
                  </span>
                  <span className={styles.reason}>{importedText(item, sessions)}</span>
                </li>
              ))}
            </ul>
          </details>
        </Card>
      )}
    </>
  );
}
