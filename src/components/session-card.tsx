import { Link } from 'react-router';
import { cx } from '@/lib/cx';
import { formatDecimal, formatInteger, formatShortMonth } from '@/lib/format';
import type { Session, SessionLabels, SessionTotals } from '@/lib/sessions';
import { Badge } from './badge';
import styles from './session-card.module.css';
import { WeatherIcon } from './weather-icon';

export interface SessionCardProps {
  session: Session;
  labels: SessionLabels;
  totals: SessionTotals;
  to: string;
  isToday?: boolean;
  /** `card` en la lista mobile; `item`, la fila compacta de W02. */
  variant?: 'card' | 'item';
  /** Sesión abierta en el panel de detalle (W02). */
  selected?: boolean;
}

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

/** Tarjeta de una sesión: fecha en bloque, configuración, polígono · munición y totales. */
export function SessionCard({
  session,
  labels,
  totals,
  to,
  isToday = false,
  variant = 'card',
  selected = false,
}: SessionCardProps) {
  const day = Number(session.date.slice(8, 10));
  const average = totals.averagePerShot === null ? null : formatDecimal(totals.averagePerShot);
  const date = (
    <span className={styles.date}>
      <span className={cx('display num', styles.day)}>{day}</span>
      <span className={cx('eyebrow', styles.month)}>{formatShortMonth(session.date)}</span>
    </span>
  );

  if (variant === 'item') {
    return (
      <Link
        to={to}
        className={cx(styles.item, selected && styles.selected)}
        aria-current={selected ? 'true' : undefined}
      >
        {date}
        <span className={styles.body}>
          <span className={styles.heading}>
            <span className={styles.title}>{labels.title}</span>
            {isToday && <Badge tone="accent">Hoy</Badge>}
          </span>
          <span className={styles.detail}>
            {labels.range} · <span className="num">{formatInteger(totals.shots)}</span>{' '}
            {plural(totals.shots, 'disparo', 'disparos')}
          </span>
        </span>
        {average && (
          <span className={cx('display num', styles.average, selected && styles.accent)}>
            <span className="visually-hidden">Promedio por tiro: </span>
            {average}
          </span>
        )}
      </Link>
    );
  }

  return (
    <Link to={to} className={cx(styles.card, isToday && styles.today)}>
      {date}
      <span className={styles.body}>
        <span className={styles.heading}>
          <span className={cx(styles.title, styles.large)}>{labels.title}</span>
          {isToday ? (
            <Badge tone="accent">Hoy</Badge>
          ) : (
            session.weather && <WeatherIcon weather={session.weather} />
          )}
        </span>
        <span className={styles.detail}>
          {labels.range} · {labels.ammunition}
        </span>
        <span className={styles.stats}>
          <span>
            <b className="num">{formatInteger(totals.rounds)}</b>{' '}
            {plural(totals.rounds, 'ronda', 'rondas')}
          </span>
          <span>
            <b className="num">{formatInteger(totals.shots)}</b>{' '}
            {plural(totals.shots, 'disparo', 'disparos')}
          </span>
          {average && (
            <span>
              <b className="num">{average}</b> prom.
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
