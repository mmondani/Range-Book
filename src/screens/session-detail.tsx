import { ChevronLeft, Crosshair, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Navigate, Outlet, useNavigate, useParams, useSearchParams } from 'react-router';
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
import { RoundRow } from '@/components/round-row';
import { RoundTable } from '@/components/round-table';
import { SessionEvolution } from '@/components/session-evolution';
import { Skeleton } from '@/components/skeleton';
import { StatTile } from '@/components/stat-tile';
import { tabPanelProps, Tabs } from '@/components/tabs';
import { Tag } from '@/components/tag';
import { TagList } from '@/components/tag-list';
import { WeatherIcon } from '@/components/weather-icon';
import { OPENED_FROM_LIST } from '@/hooks/use-inventory';
import { useIsDesktop } from '@/hooks/use-media-query';
import { useUnits } from '@/hooks/use-profile';
import {
  useDeleteSession,
  useSessionsOutlet,
  type SessionDetailOutletContext,
} from '@/hooks/use-sessions';
import { cx } from '@/lib/cx';
import { modificationName } from '@/lib/firearms';
import { formatInteger, formatLongDate, formatShortDate } from '@/lib/format';
import { photoKey, storedPhotos } from '@/lib/photos';
import { roundItems } from '@/lib/rounds';
import { sessionLabels, sessionTotals, WEATHER_LABELS } from '@/lib/sessions';
import { formatLength } from '@/lib/units';
import styles from './session-detail.module.css';

/** Pestañas del detalle: la lista de rondas o su evolución (`?vista=evolucion`). */
type SessionView = 'rondas' | 'evolucion';

const VIEW_TABS_ID = 'session-view';

/**
 * M03 · Detalle de sesión (en desktop, el panel derecho de W02): fotos, configuración y
 * personalizaciones, polígono, clima, munición, totales, rondas (o su evolución) y notas. Las rondas se agregan y
 * editan en sheets (rutas hijas).
 */
export function SessionDetail() {
  const { id = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const view: SessionView = searchParams.get('vista') === 'evolucion' ? 'evolucion' : 'rondas';
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
  const detailPath = `/sesiones/${session.id}`;
  const editPath = `${detailPath}/editar`;
  const newRoundPath = `${detailPath}/rondas/nueva`;
  const roundPath = (roundId: string) => `${detailPath}/rondas/${roundId}/editar`;
  const analysisPath = (roundId: string) => `${detailPath}/rondas/${roundId}/analisis`;
  const rounds = roundItems(session, data.targets);
  const outlet: SessionDetailOutletContext = {
    session,
    sessions: data.sessions,
    targets: data.targets,
    listPath: detailPath,
  };
  // En desktop el `<h1>` es "Sesiones", el de la lista.
  const Title = isDesktop ? 'h2' : 'h1';
  const Subtitle = isDesktop ? 'h3' : 'h2';

  // La pestaña va en la query string (sin pisar los filtros de la lista) y no apila historial.
  function changeView(next: SessionView) {
    setSearchParams(
      (params) => {
        const updated = new URLSearchParams(params);
        if (next === 'rondas') updated.delete('vista');
        else updated.set('vista', next);
        return updated;
      },
      { replace: true },
    );
  }

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

  const roundList =
    rounds.length === 0 ? (
      <EmptyState
        icon={<Crosshair />}
        title="Todavía no hay rondas"
        text="Se cargan desde acá, a medida que tirás."
        headingLevel={isDesktop ? 3 : 2}
      />
    ) : isDesktop ? (
      <Card padded={false} className={styles.table}>
        <RoundTable
          items={rounds}
          units={units}
          editPath={(item) => roundPath(item.round.id)}
          analysisPath={(item) => analysisPath(item.round.id)}
        />
      </Card>
    ) : (
      <ol className={styles.rounds} aria-label="Rondas">
        {rounds.map((item) => (
          <li key={item.round.id}>
            <RoundRow
              item={item}
              units={units}
              editPath={roundPath(item.round.id)}
              analysisPath={analysisPath(item.round.id)}
            />
          </li>
        ))}
      </ol>
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

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Tabs
            id={VIEW_TABS_ID}
            aria-label="Vista de la sesión"
            tabs={[
              { value: 'rondas', label: 'Rondas', count: totals.rounds },
              { value: 'evolucion', label: 'Evolución' },
            ]}
            value={view}
            onChange={changeView}
          />
          {isDesktop && view === 'rondas' && (
            <LinkButton variant="primary" to={newRoundPath} state={OPENED_FROM_LIST}>
              <Plus aria-hidden="true" size={18} />
              Agregar ronda
            </LinkButton>
          )}
        </div>
        {view === 'evolucion' ? (
          <div {...tabPanelProps(VIEW_TABS_ID, 'evolucion')}>
            <SessionEvolution
              rounds={session.rounds}
              units={units}
              headingLevel={isDesktop ? 3 : 2}
            />
          </div>
        ) : (
          <div {...tabPanelProps(VIEW_TABS_ID, 'rondas')}>{roundList}</div>
        )}
      </div>

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

      {!isDesktop && (
        <div className={styles.addRound}>
          <LinkButton variant="primary" to={newRoundPath} state={OPENED_FROM_LIST} block>
            <Plus aria-hidden="true" />
            Agregar ronda
          </LinkButton>
        </div>
      )}

      <Outlet context={outlet} />
    </article>
  );
}
