import { ChevronLeft, Crosshair, ImagePlus, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useBlocker, useLocation, useNavigate, useParams } from 'react-router';
import { Alert } from '@/components/alert';
import { AnalyzerToolbar, type AnalyzerMode } from '@/components/analyzer-toolbar';
import { Button } from '@/components/button';
import { CalibrationPanel } from '@/components/calibration-panel';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { ImpactTable } from '@/components/impact-table';
import { LinkButton } from '@/components/link-button';
import { MarkerPicker } from '@/components/marker-picker';
import { MetricTile } from '@/components/metric-tile';
import { ScoreTile } from '@/components/score-tile';
import { Skeleton } from '@/components/skeleton';
import { TargetAnalyzer, type AnalyzerMarker } from '@/components/target-analyzer';
import { useCurrentUser } from '@/hooks/use-auth';
import { useIsDesktop } from '@/hooks/use-media-query';
import { usePhotoRepository } from '@/hooks/use-photos';
import { useUnits } from '@/hooks/use-profile';
import { useSessionData } from '@/hooks/use-session-data';
import { useSessionRepository } from '@/hooks/use-sessions';
import { useToast } from '@/hooks/use-toast';
import {
  addImpact,
  analysisResult,
  commitImpacts,
  impactHistory,
  impactMismatch,
  impactsInMm,
  MAX_IMPACTS,
  removeImpact,
  savedImpactPixels,
  undoImpacts,
  type AnalyzedTarget,
} from '@/lib/analysis';
import {
  buildCalibration,
  calibrationDraft,
  calibrationMarkers,
  MARKER_LABELS,
  mmToPixelLength,
  nextMarker,
  previewCalibration,
  type Calibration,
  type CalibrationDraft,
  type CalibrationMarker,
  type ImageSize,
  type Pixel,
} from '@/lib/calibration';
import { cx } from '@/lib/cx';
import { formatDecimal, formatInteger, formatShortDate } from '@/lib/format';
import {
  detectImpacts,
  detectionOptions,
  detectionScale,
  holeDiameterMm,
} from '@/lib/impact-detection';
import { analysisMetrics, groupRadius, meanPoint } from '@/lib/metrics';
import { storedPhotos } from '@/lib/photos';
import { readImagePixels } from '@/lib/pixel-image';
import { sessionLabels, type Round, type Session } from '@/lib/sessions';
import { centerDetectionScale, detectTargetCenter } from '@/lib/target-center';
import { zoneScore } from '@/lib/target-zones';
import { maxZoneScore, targetName, type Target } from '@/lib/targets';
import { formatLengthValue, UNIT_SYMBOLS } from '@/lib/units';
import styles from './analysis-screen.module.css';

/** Margen del círculo de grupo alrededor del impacto más lejano al PMI. */
const GROUP_MARGIN_MM = 5;

const moaFormat = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** M06 / W04 · Análisis del blanco de una ronda. */
export function AnalysisScreen() {
  const { id = '', roundId = '' } = useParams();
  const data = useSessionData();

  if (data.status === 'error') {
    return (
      <Alert title="No se pudieron cargar los datos">Revisá la conexión y volvé a intentar.</Alert>
    );
  }
  if (data.status === 'loading') {
    return (
      <div className={styles.loading} aria-busy="true" aria-label="Cargando el análisis">
        <Skeleton shape="card" height={320} />
        <Skeleton shape="card" height={120} />
      </div>
    );
  }
  const session = data.sessions.find((item) => item.id === id);
  const index = session?.rounds.findIndex((item) => item.id === roundId) ?? -1;
  const round = session?.rounds[index];
  if (!session || !round) {
    return <Navigate to={session ? `/sesiones/${session.id}` : '/sesiones'} replace />;
  }
  const firearm = data.firearms.find((item) => item.id === session.firearmId);

  return (
    <RoundAnalyzer
      key={round.id}
      session={session}
      sessionTitle={sessionLabels(session, data.lookups).title}
      round={round}
      number={index + 1}
      target={data.targets.find((item) => item.id === round.targetId)}
      caliber={firearm?.caliber ?? ''}
    />
  );
}

interface RoundAnalyzerProps {
  session: Session;
  sessionTitle: string;
  round: Round;
  number: number;
  target: Target | undefined;
  caliber: string;
}

type Detection = 'idle' | 'detecting' | 'failed';

function RoundAnalyzer({
  session,
  sessionTitle,
  round,
  number,
  target,
  caliber,
}: RoundAnalyzerProps) {
  const uid = useCurrentUser()?.uid;
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const units = useUnits();
  const toast = useToast();
  const repository = useSessionRepository();
  const photoRepository = usePhotoRepository();

  const analyzed: AnalyzedTarget & { referenceSizeMm: number } = target ?? {
    scoring: 'none',
    zones: [],
    referenceSizeMm: 0,
  };
  const scored = maxZoneScore(analyzed) !== null;
  const saved = round.analysis;
  const detailPath = `/sesiones/${session.id}`;

  // Estado inicial: el del análisis guardado, si hay.
  const [initial] = useState(() => ({
    calibration: saved?.calibration ?? null,
    draft: calibrationDraft(analyzed, saved?.calibration),
    impacts: savedImpactPixels(saved),
    useCalculated: saved ? saved.scoreConfirmed : true,
  }));
  const [size, setSize] = useState<ImageSize | undefined>(() =>
    initial.calibration
      ? { width: initial.calibration.width, height: initial.calibration.height }
      : undefined,
  );
  const [calibration, setCalibration] = useState<Calibration | null>(initial.calibration);
  const [calibrating, setCalibrating] = useState(initial.calibration === null);
  const [draft, setDraft] = useState<CalibrationDraft>(initial.draft);
  const [active, setActive] = useState<CalibrationMarker>(
    () => nextMarker(initial.draft, analyzed.scoring) ?? 'center',
  );
  const [calibrationError, setCalibrationError] = useState<string>();
  // Borrador con el centro que se ubicó solo (blancos con anillos, análisis nuevo).
  const [autoDraft, setAutoDraft] = useState<CalibrationDraft>();
  const [locating, setLocating] = useState(false);
  // Si el usuario ya tocó la calibración, el centro encontrado tarde no la pisa.
  const touched = useRef(false);
  // Borrador de antes de empezar a arrastrar un marcador, para volver si el gesto era un zoom.
  const dragOrigin = useRef<CalibrationDraft>(undefined);
  const [history, setHistory] = useState(() => impactHistory(initial.impacts));
  const [mode, setMode] = useState<AnalyzerMode>('add');
  const [detection, setDetection] = useState<Detection>('idle');
  const [useCalculated, setUseCalculated] = useState(initial.useCalculated);
  const [saving, setSaving] = useState(false);
  const leaving = useRef(false);

  const dirty =
    (draft !== initial.draft && draft !== autoDraft) ||
    calibration !== initial.calibration ||
    history.impacts !== initial.impacts ||
    useCalculated !== initial.useCalculated;

  // Salir con cambios sin guardar (volver, "atrás", otra sección) pide confirmación.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !leaving.current && dirty && !saving && currentLocation.pathname !== nextLocation.pathname,
  );

  // Si la detección sigue corriendo al salir, su resultado se descarta.
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  function close() {
    // Si se entró directo por URL no hay adónde volver en el historial.
    if (location.key !== 'default') navigate(-1);
    else navigate(detailPath, { replace: true });
  }

  const photo = round.photo ? storedPhotos([round.photo])[0] : undefined;
  const title = `Análisis · Ronda ${number}`;
  const subtitle = [
    target ? targetName(target) : 'Blanco desconocido',
    `${formatDecimal(round.distanceM)} m`,
    `${formatInteger(round.shots)} disparos${isDesktop ? ' declarados' : ''}`,
  ].join(' · ');

  // --- Calibración -----------------------------------------------------------------------------

  /** Mientras se arrastra, el marcador activo sigue al dedo sin pasar al siguiente. */
  function moveMarker(pixel: Pixel) {
    touched.current = true;
    dragOrigin.current ??= draft;
    setDraft({ ...draft, [active]: pixel });
    setCalibrationError(undefined);
  }

  /** Arrastre interrumpido por un zoom: el marcador vuelve a donde estaba. */
  function cancelMarkerMove() {
    if (dragOrigin.current) setDraft(dragOrigin.current);
    dragOrigin.current = undefined;
  }

  function placeMarker(pixel: Pixel) {
    touched.current = true;
    dragOrigin.current = undefined;
    const next = { ...draft, [active]: pixel };
    setDraft(next);
    setCalibrationError(undefined);
    // Pasa solo al próximo marcador que falte.
    const missing = nextMarker(next, analyzed.scoring);
    if (missing) setActive(missing);
  }

  /** Busca el centro de los anillos en la foto y lo propone; si no lo encuentra, se toca a mano. */
  async function locateCenter(loaded: ImageSize) {
    if (!round.photo) return;
    setLocating(true);
    try {
      const blob = await photoRepository.blob(round.photo);
      const pixels = await readImagePixels(blob, centerDetectionScale(loaded));
      // Deja que se vea el overlay antes del cálculo, que bloquea el hilo principal.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const found = detectTargetCenter(pixels);
      if (!found || !mounted.current || touched.current) return;
      // Del centro del píxel de la foto reducida al punto de la original.
      const next: CalibrationDraft = {
        ...initial.draft,
        center: {
          x: ((found.x + 0.5) * loaded.width) / pixels.width,
          y: ((found.y + 0.5) * loaded.height) / pixels.height,
        },
      };
      setDraft(next);
      setAutoDraft(next);
      setActive('edge');
    } catch {
      // Sin la foto en píxeles (CORS, navegador sin canvas), el centro se ubica a mano.
    } finally {
      if (mounted.current) setLocating(false);
    }
  }

  function handleSize(loaded: ImageSize) {
    if (size) return;
    setSize(loaded);
    if (calibrating && scored && !draft.center) void locateCenter(loaded);
  }

  function confirmCalibration() {
    if (!size) return;
    const result = buildCalibration(draft, analyzed.scoring, size);
    if ('error' in result) {
      setCalibrationError(result.error);
      return;
    }
    setCalibration(result.calibration);
    setCalibrating(false);
    // La primera vez se detectan los impactos solos.
    if (history.impacts.length === 0 && !saved) void detect(result.calibration);
  }

  function recalibrate() {
    setDraft(calibrationDraft(analyzed, calibration));
    setActive('center');
    setCalibrationError(undefined);
    setCalibrating(true);
  }

  // --- Impactos --------------------------------------------------------------------------------

  async function detect(current: Calibration) {
    if (!round.photo) return;
    setDetection('detecting');
    try {
      const holeMm = holeDiameterMm(caliber);
      const blob = await photoRepository.blob(round.photo);
      const pixels = await readImagePixels(blob, detectionScale(current, holeMm));
      // La foto reducida se redondea: se usa la escala real de cada eje.
      const scaleX = pixels.width / current.width;
      const scaleY = pixels.height / current.height;
      // Deja que se vea el overlay antes del cálculo, que bloquea el hilo principal.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const found = detectImpacts(pixels, {
        ...detectionOptions(current, analyzed.zones, holeMm, scaleX),
        maxImpacts: MAX_IMPACTS,
      });
      if (!mounted.current) return;
      if (found.length === 0) {
        setDetection('failed');
        return;
      }
      setHistory((previous) =>
        commitImpacts(
          previous,
          found.map(({ x, y }) => ({ x: (x + 0.5) / scaleX, y: (y + 0.5) / scaleY })),
        ),
      );
      setDetection('idle');
    } catch {
      if (mounted.current) setDetection('failed');
    }
  }

  function handlePoint(pixel: Pixel) {
    if (calibrating) {
      placeMarker(pixel);
      return;
    }
    if (history.impacts.length >= MAX_IMPACTS) {
      toast.show({ message: `Podés marcar hasta ${MAX_IMPACTS} impactos`, tone: 'error' });
      return;
    }
    setHistory(addImpact(history, pixel));
    setDetection('idle');
  }

  function handleRemove(index: number) {
    setHistory(removeImpact(history, index));
    setDetection('idle');
  }

  // --- Guardado --------------------------------------------------------------------------------

  async function save() {
    if (!uid || !calibration) return;
    if (history.impacts.length === 0) {
      toast.show({ message: 'Marcá al menos un impacto para guardar el análisis', tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      await repository.saveAnalysis(
        uid,
        session.id,
        round.id,
        analysisResult(calibration, history.impacts, analyzed, round.distanceM, useCalculated),
      );
    } catch {
      setSaving(false);
      toast.show({ message: 'No se pudo guardar el análisis', tone: 'error' });
      return;
    }
    leaving.current = true;
    toast.show({ message: 'Análisis guardado' });
    close();
  }

  // --- Vista -----------------------------------------------------------------------------------

  const points = calibration ? impactsInMm(calibration, history.impacts) : [];
  const metrics = analysisMetrics(points, analyzed, round.distanceM);
  const zoneLabel = (index: number) => {
    const point = points[index];
    return scored && point
      ? `Impacto ${index + 1}, zona ${zoneScore(analyzed.zones, point)}`
      : `Impacto ${index + 1}`;
  };
  const unit = UNIT_SYMBOLS[units];
  const length = (mm: number | null) => (mm === null ? '—' : formatLengthValue(mm, units));
  const mismatch = impactMismatch(history.impacts.length, round.shots);
  const canUndo = history.past.length > 0;

  // Superposiciones de la calibración: marcadores y anillos (o la línea A–B) en vivo.
  const preview = size ? previewCalibration(draft, analyzed.scoring, size) : undefined;
  const markers: AnalyzerMarker[] = calibrating
    ? calibrationMarkers(analyzed.scoring).flatMap((marker) => {
        const at = draft[marker];
        return at
          ? [
              {
                key: marker,
                at,
                cross: marker === 'center',
                text: marker === 'a' ? 'A' : marker === 'b' ? 'B' : undefined,
                active: marker === active,
              },
            ]
          : [];
      })
    : [];
  const rings =
    calibrating && preview
      ? analyzed.zones.map((zone) => ({
          key: String(zone.diameterMm),
          center: preview.center,
          radius: mmToPixelLength(preview, zone.diameterMm / 2),
        }))
      : [];
  const line: [Pixel, Pixel] | undefined =
    calibrating && draft.a && draft.b ? [draft.a, draft.b] : undefined;

  // PMI y grupo sobre la foto, en píxeles (la escala es la misma en los dos ejes).
  const mpi = calibrating ? null : meanPoint(history.impacts);
  const group =
    mpi && calibration && history.impacts.length >= 2
      ? {
          center: mpi,
          radius: groupRadius(history.impacts, mpi) + mmToPixelLength(calibration, GROUP_MARGIN_MM),
        }
      : null;

  const primary = calibrating ? (
    <Button variant="primary" block={!isDesktop} onClick={confirmCalibration} disabled={!size}>
      Continuar
    </Button>
  ) : (
    <Button
      variant="primary"
      block={!isDesktop}
      loading={saving}
      onClick={() => void save()}
      disabled={detection === 'detecting'}
    >
      Guardar análisis
    </Button>
  );

  const confirmScore = !calibrating && scored && (
    <label className={styles.confirm}>
      <input
        type="checkbox"
        checked={useCalculated}
        onChange={(event) => setUseCalculated(event.target.checked)}
      />
      <span>
        Usar el puntaje calculado (<b className="num">{formatInteger(metrics.score ?? 0)}</b>) en la
        ronda.{' '}
        {round.manualScore === null
          ? 'No tiene puntaje cargado a mano.'
          : `Puntaje cargado: ${formatInteger(round.manualScore)}.`}
      </span>
    </label>
  );

  const undoButton = isDesktop ? (
    <Button variant="ghost" onClick={() => setHistory(undoImpacts(history))} disabled={!canUndo}>
      <Undo2 aria-hidden="true" size={18} />
      Deshacer
    </Button>
  ) : (
    <IconButton
      aria-label="Deshacer último cambio"
      onClick={() => setHistory(undoImpacts(history))}
      disabled={!canUndo}
    >
      <Undo2 aria-hidden="true" />
    </IconButton>
  );

  return (
    <div className={cx(styles.screen, photo && styles.withActions)}>
      {isDesktop && (
        <nav aria-label="Ruta" className={styles.breadcrumb}>
          <ol>
            <li>
              <Link to="/sesiones">Sesiones</Link>
            </li>
            <li>
              <Link to={detailPath}>
                {formatShortDate(session.date)} · {sessionTitle}
              </Link>
            </li>
            <li aria-current="page">Ronda {number}</li>
          </ol>
        </nav>
      )}

      <header className={styles.header}>
        {!isDesktop && (
          <IconButton aria-label="Volver a la sesión" onClick={close}>
            <ChevronLeft aria-hidden="true" />
          </IconButton>
        )}
        <div className={styles.titles}>
          <h1 className={cx('display', styles.title)}>{title}</h1>
          <span className={styles.subtitle}>{subtitle}</span>
        </div>
        {!isDesktop && photo && !calibrating && undoButton}
        {isDesktop && photo && (
          <div className={styles.headerActions}>
            <Button variant="ghost" onClick={close} disabled={saving}>
              Cancelar
            </Button>
            {primary}
          </div>
        )}
      </header>

      {!photo ? (
        <EmptyState
          icon={<ImagePlus />}
          title="Esta ronda no tiene foto"
          text="Agregá la foto del blanco para marcar los impactos y calcular las métricas."
          action={
            <LinkButton variant="primary" to={`${detailPath}/rondas/${round.id}/editar`} replace>
              Agregar foto
            </LinkButton>
          }
        />
      ) : (
        <div className={styles.layout}>
          <section aria-label="Blanco" className={styles.targetPanel}>
            {isDesktop && !calibrating && (
              <div className={styles.toolbarRow}>
                <AnalyzerToolbar
                  mode={mode}
                  onMode={setMode}
                  onDetect={() => calibration && void detect(calibration)}
                  detecting={detection === 'detecting'}
                />
                {undoButton}
              </div>
            )}
            <TargetAnalyzer
              photo={photo}
              alt={`Foto del blanco de la ronda ${number}`}
              size={size}
              onSize={handleSize}
              pointLabel={
                calibrating
                  ? `Ubicar ${MARKER_LABELS[active].toLocaleLowerCase('es-AR')} en el punto indicado`
                  : mode === 'add'
                    ? 'Agregar impacto en el punto indicado'
                    : undefined
              }
              onPoint={handlePoint}
              onPointMove={calibrating ? moveMarker : undefined}
              onPointCancel={cancelMarkerMove}
              markers={markers}
              rings={rings}
              line={line}
              impacts={history.impacts}
              impactLabel={zoneLabel}
              onRemoveImpact={!calibrating && mode === 'remove' ? handleRemove : undefined}
              mpi={mpi}
              group={group}
              controls={
                calibrating && (
                  <MarkerPicker
                    scoring={analyzed.scoring}
                    draft={draft}
                    active={active}
                    onActive={setActive}
                  />
                )
              }
              busy={
                detection === 'detecting'
                  ? 'Detectando impactos…'
                  : locating
                    ? 'Buscando el centro…'
                    : undefined
              }
              className={styles.target}
            />
            {!calibrating && (
              <ul className={styles.legend} aria-label="Referencias">
                <li>
                  <span aria-hidden="true" className={styles.legendImpact} />
                  Impacto
                </li>
                <li>
                  <span aria-hidden="true" className={styles.legendMpi}>
                    +
                  </span>
                  {isDesktop ? 'PMI (punto medio de impacto)' : 'PMI'}
                </li>
                <li>
                  <span aria-hidden="true" className={styles.legendGroup} />
                  Grupo
                </li>
              </ul>
            )}
          </section>

          <div className={styles.side}>
            {calibrating ? (
              <CalibrationPanel
                scoring={analyzed.scoring}
                zones={analyzed.zones}
                draft={draft}
                active={active}
                autoCenter={autoDraft !== undefined && draft.center === autoDraft.center}
                onChange={(changes) => {
                  touched.current = true;
                  setDraft({ ...draft, ...changes });
                  setCalibrationError(undefined);
                }}
                error={calibrationError}
              />
            ) : (
              <>
                {!isDesktop && (
                  <AnalyzerToolbar
                    compact
                    mode={mode}
                    onMode={setMode}
                    onDetect={() => calibration && void detect(calibration)}
                    detecting={detection === 'detecting'}
                  />
                )}

                {detection === 'failed' && (
                  <Alert tone="warning" title="No se pudieron detectar los impactos">
                    Marcalos tocando el blanco en modo Agregar.
                  </Alert>
                )}

                {mismatch && (
                  <p role="status" className={styles.mismatch}>
                    <span>
                      <b className="num">{formatInteger(history.impacts.length)}</b> impactos
                      marcados de <b className="num">{formatInteger(round.shots)}</b> disparos.{' '}
                      {mismatch}
                    </span>
                  </p>
                )}

                <section aria-label="Métricas" className={styles.metrics}>
                  {scored ? (
                    <ScoreTile metrics={metrics}>{isDesktop && confirmScore}</ScoreTile>
                  ) : (
                    <p className={styles.note}>
                      Este blanco no tiene zonas: el puntaje de la ronda es el cargado a mano.
                    </p>
                  )}
                  <div className={styles.tiles}>
                    <MetricTile
                      size={isDesktop ? 'md' : 'sm'}
                      label={isDesktop ? 'Tamaño de grupo' : 'Grupo'}
                      value={length(metrics.groupSizeMm)}
                      unit={unit}
                      help={
                        metrics.groupSizeMoa === null
                          ? 'Con 2 impactos o más'
                          : `≈ ${moaFormat.format(metrics.groupSizeMoa)} MOA${
                              isDesktop ? ` a ${formatDecimal(round.distanceM)} m` : ''
                            }`
                      }
                    />
                    <MetricTile
                      size={isDesktop ? 'md' : 'sm'}
                      label={isDesktop ? 'Desvío PMI' : 'PMI'}
                      value={length(metrics.mpiOffsetMm)}
                      unit={unit}
                      help={
                        metrics.mpiClock === null
                          ? metrics.mpi
                            ? 'Centrado'
                            : '—'
                          : `Hacia las ${metrics.mpiClock} h`
                      }
                    />
                    <MetricTile
                      size={isDesktop ? 'md' : 'sm'}
                      label={isDesktop ? 'Dist. al centro' : 'Al centro'}
                      value={length(metrics.meanDistanceMm)}
                      unit={unit}
                      help={isDesktop ? 'Promedio por tiro' : 'Prom. por tiro'}
                    />
                  </div>
                </section>

                <Button variant="ghost" onClick={recalibrate} className={styles.recalibrate}>
                  <Crosshair aria-hidden="true" size={18} />
                  Recalibrar la foto
                </Button>

                {isDesktop && (
                  <ImpactTable
                    impacts={points}
                    zoneOf={scored ? (point) => zoneScore(analyzed.zones, point) : undefined}
                    units={units}
                    onRemove={handleRemove}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {!isDesktop && photo && (
        <div className={styles.actions}>
          {confirmScore}
          {primary}
        </div>
      )}

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="¿Descartar el análisis?"
        description="Los cambios que hiciste en el análisis no se van a guardar."
        confirmLabel="Descartar"
        cancelLabel="Seguir editando"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => {
          leaving.current = true;
          blocker.proceed?.();
        }}
      />
    </div>
  );
}
