import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { IconButton } from '@/components/icon-button';
import { MantisShotList } from '@/components/mantis-shot-list';
import { MantisShotTrace } from '@/components/mantis-shot-trace';
import { Skeleton } from '@/components/skeleton';
import { StatTile } from '@/components/stat-tile';
import type { PlaybackSpeed } from '@/components/trace-playback';
import { useMantisTrace, useRemoveMantis } from '@/hooks/use-mantis';
import { useIsDesktop } from '@/hooks/use-media-query';
import { useSessionData } from '@/hooks/use-session-data';
import { cx } from '@/lib/cx';
import { formatDayMonthYear, formatFixed, formatShortDate, formatTime } from '@/lib/format';
import { findShotTrace } from '@/lib/mantis';
import { mantisLocalDate } from '@/lib/mantis-matching';
import { problemLabel } from '@/lib/mantis-problems';
import { angleClock, mantisStats } from '@/lib/mantis-trace';
import { sessionLabels } from '@/lib/sessions';
import styles from './mantis-round-screen.module.css';

/** Yardas a metros (la distancia de MantisX, si la ronda no tiene). */
const M_PER_YARD = 0.9144;

/**
 * M15 / W10 · MantisX de la ronda: resumen, trayectoria del disparo elegido (estática y
 * animada) y lista de disparos. La trayectoria se lee aparte, al abrir la pantalla.
 */
export function MantisRoundScreen() {
  const { id = '', roundId = '' } = useParams();
  const data = useSessionData();
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const location = useLocation();
  const removeMantis = useRemoveMantis();
  const session =
    data.status === 'ready' ? data.sessions.find((item) => item.id === id) : undefined;
  const index = session?.rounds.findIndex((item) => item.id === roundId) ?? -1;
  const round = session?.rounds[index];
  const mantis = round?.mantis ?? undefined;
  const trace = useMantisTrace(mantis?.sessionPk);
  const [selected, setSelected] = useState(0);
  const [speed, setSpeed] = useState<PlaybackSpeed>('slow');
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const detailPath = `/sesiones/${id}`;

  if (data.status === 'loading') {
    return (
      <div className={styles.screen} aria-busy="true" aria-label="Cargando los datos de MantisX">
        <Skeleton shape="card" height={120} />
        <Skeleton shape="card" height={320} />
      </div>
    );
  }
  if (data.status === 'error') {
    return (
      <Alert title="No se pudieron cargar los datos de MantisX">
        Revisá la conexión y volvé a intentar.
      </Alert>
    );
  }
  // Sin sesión, sin ronda o sin datos de MantisX: vuelve a la sesión.
  if (!session || !round || !mantis) {
    return <Navigate to={session ? detailPath : '/sesiones'} replace />;
  }

  function close() {
    // Si se entró directo por URL no hay adónde volver en el historial.
    if (location.key !== 'default') navigate(-1);
    else navigate(detailPath, { replace: true });
  }

  async function handleRemove() {
    if (!session || !round) return;
    setRemoving(true);
    const removed = await removeMantis(session, round);
    setRemoving(false);
    setConfirming(false);
    if (removed) navigate(detailPath, { replace: true });
  }

  const number = index + 1;
  const shots = mantis.shots;
  const current = Math.min(selected, shots.length - 1);
  const shot = shots[current]!;
  const stats = mantisStats(shots);
  const distanceM =
    round.distanceM > 0
      ? round.distanceM
      : (mantis.distance?.value ?? 0) * (mantis.distance?.metric ? 1 : M_PER_YARD);
  const labels = sessionLabels(session, data.lookups);
  const subtitle = [
    mantis.hardware,
    [mantis.firearm.make, mantis.firearm.model].filter(Boolean).join(' '),
    mantis.rightHanded ? 'Diestro' : 'Zurdo',
    'Open Training',
  ]
    .filter(Boolean)
    .join(' · ');
  const shotTrace = trace.status === 'ready' ? findShotTrace(trace.trace, shot.pk) : undefined;

  function select(next: number) {
    setSelected(Math.max(0, Math.min(next, shots.length - 1)));
  }

  return (
    <div className={styles.screen}>
      {isDesktop ? (
        <nav aria-label="Ruta" className={styles.breadcrumb}>
          <ol>
            <li>
              <Link to="/sesiones">Sesiones</Link>
            </li>
            <li>
              <Link to={detailPath}>
                {formatShortDate(session.date)} · {labels.title}
              </Link>
            </li>
            <li aria-current="page">Ronda {number}</li>
          </ol>
        </nav>
      ) : (
        <header className={styles.back}>
          <IconButton aria-label="Volver a la sesión" onClick={close}>
            <ChevronLeft aria-hidden="true" />
          </IconButton>
          <span className={styles.backLabel}>Sesión</span>
        </header>
      )}

      <header className={styles.header}>
        <div className={styles.titles}>
          <span className="eyebrow">
            Ronda {number} · {formatDayMonthYear(mantisLocalDate(mantis))} ·{' '}
            {formatTime(mantis.date)}
          </span>
          <h1 className={cx('display', styles.title)}>MantisX</h1>
          <span className={styles.subtitle}>{subtitle}</span>
        </div>
        {isDesktop && (
          <Button variant="danger" onClick={() => setConfirming(true)}>
            <Trash2 aria-hidden="true" size={18} />
            Quitar los datos de MantisX
          </Button>
        )}
      </header>

      <section aria-label="Resumen" className={styles.summary}>
        <Card>
          <StatTile
            label={isDesktop ? 'Puntaje promedio' : 'Puntaje'}
            value={formatFixed(stats.averageScore, 1)}
            help={isDesktop ? undefined : 'Promedio'}
            size={isDesktop ? 'md' : 'sm'}
          />
        </Card>
        <Card>
          <StatTile
            label={isDesktop ? 'Tiempo total' : 'Tiempo'}
            value={formatFixed(stats.totalTime, 1)}
            unit="s"
            help={isDesktop ? undefined : 'Total'}
            size={isDesktop ? 'md' : 'sm'}
          />
        </Card>
        <Card>
          <StatTile
            label={isDesktop ? 'Split promedio' : 'Split'}
            value={stats.averageSplit === null ? '—' : formatFixed(stats.averageSplit, 2)}
            unit={stats.averageSplit === null ? undefined : 's'}
            help={isDesktop ? undefined : 'Promedio'}
            size={isDesktop ? 'md' : 'sm'}
          />
        </Card>
      </section>
      <p className={styles.note}>
        El puntaje de MantisX mide el control del gatillo, no dónde pegó el disparo en el blanco.
      </p>

      <div className={styles.layout}>
        <Card as="section" aria-labelledby="mantis-shot-title" className={styles.traceCard}>
          <div className={styles.traceHeader}>
            <h2 id="mantis-shot-title" className={styles.cardTitle}>
              Disparo {current + 1} de {shots.length}
            </h2>
            <div className={styles.nav}>
              <IconButton
                aria-label="Disparo anterior"
                disabled={current === 0}
                onClick={() => select(current - 1)}
              >
                <ChevronLeft aria-hidden="true" />
              </IconButton>
              <IconButton
                aria-label="Disparo siguiente"
                disabled={current === shots.length - 1}
                onClick={() => select(current + 1)}
              >
                <ChevronRight aria-hidden="true" />
              </IconButton>
            </div>
          </div>

          {trace.status === 'loading' ? (
            <div className={styles.traceSlot}>
              <Skeleton shape="card" height={isDesktop ? 386 : 280} />
            </div>
          ) : trace.status === 'missing' || !shotTrace ? (
            <Alert tone="warning" title="No se pudo cargar la trayectoria">
              Puede que todavía no se haya sincronizado. El resto de los datos se ve igual.
            </Alert>
          ) : (
            <MantisShotTrace
              shot={shotTrace}
              sampleRate={trace.trace.sampleRate}
              number={current + 1}
              distanceM={distanceM}
              size={isDesktop ? 386 : 280}
              speed={speed}
              onSpeedChange={setSpeed}
            />
          )}

          <dl className={cx(styles.values, isDesktop && styles.valuesWide)}>
            <div className={styles.value}>
              <dt className="eyebrow">Puntaje</dt>
              <dd className="num">{formatFixed(shot.score, 1)}</dd>
            </div>
            <div className={styles.value}>
              <dt className="eyebrow">Split</dt>
              <dd className="num">{current === 0 ? '—' : `${formatFixed(shot.split, 2)} s`}</dd>
            </div>
            <div className={cx(styles.value, styles.wide)}>
              <dt className="eyebrow">Diagnóstico</dt>
              <dd>{problemLabel(shot.problem)}</dd>
            </div>
            <div className={styles.value}>
              <dt className="eyebrow">Dirección</dt>
              <dd className="num">{angleClock(shot.angle)} h</dd>
            </div>
            <div className={styles.value}>
              <dt className="eyebrow">Inclinación arma</dt>
              <dd className="num">
                {shot.cant === null ? '—' : `${formatFixed(Math.abs(shot.cant), 1)}°`}
              </dd>
            </div>
            <div className={styles.value}>
              <dt className="eyebrow">Mov. apuntando</dt>
              <dd className="num">{formatFixed(shot.triggerHold, 2)}</dd>
            </div>
            <div className={styles.value}>
              <dt className="eyebrow">Mov. disparando</dt>
              <dd className="num">{formatFixed(shot.triggerPull, 2)}</dd>
            </div>
          </dl>
        </Card>

        <section aria-labelledby="mantis-shots-title" className={styles.shots}>
          <h2 id="mantis-shots-title" className="eyebrow">
            Disparos
          </h2>
          <MantisShotList shots={shots} stats={stats} selected={current} onSelect={select} />
          <p className={styles.note}>
            {isDesktop ? 'Elegí' : 'Tocá'} un disparo para ver su trayectoria.
          </p>
        </section>
      </div>

      {!isDesktop && (
        <Button variant="danger" onClick={() => setConfirming(true)} className={styles.remove}>
          <Trash2 aria-hidden="true" size={18} />
          Quitar los datos de MantisX
        </Button>
      )}

      <ConfirmDialog
        open={confirming}
        title="¿Quitar los datos de MantisX?"
        description={`Se quitan el puntaje, los tiempos y la trayectoria de la ronda ${number}. Podés volver a importarlos desde el archivo.`}
        confirmLabel="Quitar"
        loading={removing}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void handleRemove()}
      />
    </div>
  );
}
