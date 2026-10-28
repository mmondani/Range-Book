import { ChevronLeft, Crosshair, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { IconLink } from '@/components/icon-link';
import { LinkButton } from '@/components/link-button';
import { Photo } from '@/components/photo';
import { PhotoStrip } from '@/components/photo-strip';
import { Skeleton } from '@/components/skeleton';
import { StatTile } from '@/components/stat-tile';
import { Tag } from '@/components/tag';
import { TagList } from '@/components/tag-list';
import { WeatherIcon } from '@/components/weather-icon';
import { useIsDesktop } from '@/hooks/use-media-query';
import { useUnits } from '@/hooks/use-profile';
import { useDeleteSession, useSessionsOutlet } from '@/hooks/use-sessions';
import { cx } from '@/lib/cx';
import { modificationName } from '@/lib/firearms';
import { formatDecimal, formatInteger, formatLongDate, formatShortDate } from '@/lib/format';
import { photoKey, storedPhotos } from '@/lib/photos';
import { roundScore, sessionLabels, sessionTotals, WEATHER_LABELS } from '@/lib/sessions';
import { targetName } from '@/lib/targets';
import { formatLength } from '@/lib/units';
import styles from './session-detail.module.css';

/**
 * M03 · Detalle de sesión (en desktop, el panel derecho de W02): fotos, configuración y
 * personalizaciones, polígono, clima, munición, totales, rondas y notas.
 */
export function SessionDetail() {
  const { id = '' } = useParams();
  const { data, listPath } = useSessionsOutlet();
  const isDesktop = useIsDesktop();
  const units = useUnits();
  const navigate = useNavigate();
  const deleteSession = useDeleteSession();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (data.status === 'loading') {
    return (
      <div className={styles.loading} aria-busy="true" aria-label="Cargando la sesión">
        <Skeleton shape="card" height={200} />
        <Skeleton shape="card" height={96} />
      </div>
    );
  }
  if (data.status === 'error') {
    return (
      <Alert title="No se pudo cargar la sesión">Revisá la conexión y volvé a intentar.</Alert>
    );
  }
  const session = data.sessions.find((item) => item.id === id);
  if (!session) return <Navigate to={listPath} replace />;

  const labels = sessionLabels(session, data.lookups);
  const totals = sessionTotals(session, data.targets);
  const photos = storedPhotos(session.photos);
  const editPath = `/sesiones/${session.id}/editar`;
  // En desktop el `<h1>` es "Sesiones", el de la lista.
  const Title = isDesktop ? 'h2' : 'h1';
  const Subtitle = isDesktop ? 'h3' : 'h2';

  async function handleDelete() {
    if (!session) return;
    setDeleting(true);
    const deleted = await deleteSession(session);
    setDeleting(false);
    setConfirming(false);
    if (deleted) navigate(listPath, { replace: true });
  }

  const score =
    totals.score === null ? (
      '—'
    ) : (
      <>
        {formatInteger(totals.score)}
        {totals.maxScore !== null && (
          <span className={styles.max}> / {formatInteger(totals.maxScore)}</span>
        )}
      </>
    );

  return (
    <article className={styles.detail} aria-labelledby="session-title">
      {!isDesktop && (
        <PhotoStrip
          photos={photos}
          label="Fotos del polígono"
          className={styles.strip}
          actions={
            <>
              <IconLink to={listPath} aria-label="Volver a sesiones" onPhoto={photos.length > 0}>
                <ChevronLeft aria-hidden="true" />
              </IconLink>
              <span className={styles.stripActions}>
                <IconLink to={editPath} aria-label="Editar sesión" onPhoto={photos.length > 0}>
                  <Pencil aria-hidden="true" />
                </IconLink>
                <IconButton
                  aria-label="Eliminar sesión"
                  onPhoto={photos.length > 0}
                  onClick={() => setConfirming(true)}
                >
                  <Trash2 aria-hidden="true" />
                </IconButton>
              </span>
            </>
          }
        />
      )}

      <header className={styles.header}>
        <div className={styles.titles}>
          <span className="eyebrow">
            {isDesktop ? formatLongDate(session.date) : formatShortDate(session.date)}
          </span>
          <Title id="session-title" className={cx('display', styles.title)}>
            {labels.title}
          </Title>
          {session.modificationsSnapshot.length > 0 && (
            <TagList aria-label="Personalizaciones">
              {session.modificationsSnapshot.map((modification, index) => (
                <li key={index}>
                  <Tag>{modificationName(modification)}</Tag>
                </li>
              ))}
            </TagList>
          )}
        </div>
        {isDesktop && (
          <div className={styles.actions}>
            <LinkButton variant="ghost" to={editPath}>
              <Pencil aria-hidden="true" size={18} />
              Editar
            </LinkButton>
            <Button variant="danger" onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden="true" size={18} />
              Eliminar
            </Button>
          </div>
        )}
      </header>

      <Card as="div" padded={false} className={styles.data}>
        <dl className={styles.dataList}>
          <div>
            <dt className="eyebrow">Polígono</dt>
            <dd>{labels.range}</dd>
          </div>
          <div>
            <dt className="eyebrow">Clima</dt>
            <dd className={styles.weather}>
              {session.weather ? (
                <>
                  <WeatherIcon weather={session.weather} decorative />
                  {WEATHER_LABELS[session.weather]}
                </>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div className={styles.wide}>
            <dt className="eyebrow">Munición</dt>
            <dd>{labels.ammunition}</dd>
          </div>
        </dl>
      </Card>

      <section aria-label="Totales" className={styles.totals}>
        <Card>
          <StatTile label="Disparos" value={formatInteger(totals.shots)} />
        </Card>
        <Card>
          <StatTile label="Puntaje" value={score} accent={isDesktop && totals.score !== null} />
        </Card>
        <Card>
          <StatTile
            label="Grupo"
            value={totals.groupSizeMm === null ? '—' : formatLength(totals.groupSizeMm, units)}
          />
        </Card>
      </section>

      {isDesktop && photos.length > 0 && (
        <ul aria-label="Fotos del polígono" className={styles.photos}>
          {photos.map((photo, index) => (
            <li key={photoKey(photo)}>
              <Photo
                photo={photo}
                alt={`Foto ${index + 1} de ${photos.length}`}
                className={styles.photo}
              />
            </li>
          ))}
        </ul>
      )}

      <section className={styles.section} aria-labelledby="session-rounds">
        <Subtitle id="session-rounds" className={cx('display', styles.sectionTitle)}>
          Rondas <span className={cx('num', styles.count)}>· {totals.rounds}</span>
        </Subtitle>
        {session.rounds.length === 0 ? (
          <EmptyState
            icon={<Crosshair />}
            title="Todavía no hay rondas"
            text="Se cargan desde acá, a medida que tirás."
            headingLevel={isDesktop ? 3 : 2}
          />
        ) : (
          <ol className={styles.rounds}>
            {session.rounds.map((round, index) => {
              const target = data.targets.find((item) => item.id === round.targetId);
              const value = roundScore(round);
              return (
                <li key={round.id}>
                  <Card className={styles.round}>
                    <span className={styles.roundTitle}>Ronda {index + 1}</span>
                    <span className={cx('num', styles.roundData)}>
                      {formatInteger(round.shots)} disparos
                      {value !== null && ` · ${formatInteger(value)} pts`} ·{' '}
                      {formatDecimal(round.distanceM)} m
                    </span>
                    <span className={styles.roundTarget}>
                      {target ? targetName(target) : 'Blanco desconocido'}
                      {round.comments && ` · ${round.comments}`}
                    </span>
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {session.notes && (
        <Card as="section" aria-labelledby="session-notes" className={styles.notes}>
          <Subtitle id="session-notes" className="eyebrow">
            Notas
          </Subtitle>
          <p>{session.notes}</p>
        </Card>
      )}

      <ConfirmDialog
        open={confirming}
        title="¿Eliminar la sesión?"
        description="Se borran sus rondas y sus fotos. Vas a poder deshacerlo durante unos segundos."
        confirmLabel="Eliminar"
        loading={deleting}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void handleDelete()}
      />
    </article>
  );
}
