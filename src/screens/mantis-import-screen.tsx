import { Check, ChevronLeft, FileUp, Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { Link, useBlocker, useLocation, useNavigate } from 'react-router';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { MantisExportHelp } from '@/components/mantis-export-help';
import { MantisMatchList } from '@/components/mantis-match-list';
import { MantisSkippedList } from '@/components/mantis-skipped-list';
import { useImportMantis } from '@/hooks/use-mantis';
import { useIsDesktop } from '@/hooks/use-media-query';
import { useSessionData } from '@/hooks/use-session-data';
import { useToast } from '@/hooks/use-toast';
import { cx } from '@/lib/cx';
import { formatNumericDayMonth } from '@/lib/format';
import type { RoundMantis } from '@/lib/mantis';
import {
  MANTIS_IMPORT_ERRORS,
  parseMantisFile,
  type MantisFile,
  type MantisImportError,
} from '@/lib/mantis-import';
import {
  assignRound,
  mantisLocalDate,
  matchedImports,
  omittedNote,
  proposeMatching,
  type MantisMatching,
} from '@/lib/mantis-matching';
import styles from './mantis-import-screen.module.css';

const SESSIONS_PATH = '/sesiones';

interface Review {
  fileName: string;
  file: MantisFile;
  summaries: Map<number, RoundMantis>;
  matching: MantisMatching;
}

const roundsLabel = (count: number) => (count === 1 ? '1 ronda' : `${count} rondas`);

/**
 * M14 / W09 · Importar MantisX. Dos etapas en la misma ruta: elegir el archivo exportado con el
 * marcador y revisar a qué ronda va cada sesión de MantisX (propuesta por la hora). Lo importado
 * se guarda en Firestore; sin conexión, se sincroniza al volver.
 */
export function MantisImportScreen() {
  const data = useSessionData();
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const importMantis = useImportMantis();
  const input = useRef<HTMLInputElement>(null);
  const [review, setReview] = useState<Review>();
  const [error, setError] = useState<MantisImportError>();
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const leaving = useRef(false);

  // Salir con una revisión sin importar pide confirmación.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !leaving.current &&
      review !== undefined &&
      !importing &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  const ready = data.status === 'ready' ? data : undefined;

  function close() {
    // Si se entró directo por URL no hay adónde volver en el historial.
    if (location.key !== 'default') navigate(-1);
    else navigate(SESSIONS_PATH, { replace: true });
  }

  async function readFile(file: File) {
    if (!ready) return;
    setReading(true);
    setError(undefined);
    let content: string;
    try {
      content = await file.text();
    } catch {
      setReading(false);
      setError('unreadable');
      return;
    }
    const result = parseMantisFile(content);
    setReading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const summaries = result.file.sessions.map((session) => session.summary);
    setReview({
      fileName: file.name,
      file: result.file,
      summaries: new Map(summaries.map((summary) => [summary.sessionPk, summary])),
      matching: proposeMatching(summaries, ready.sessions, ready.firearms),
    });
  }

  function chooseFile() {
    input.current?.click();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const [file] = event.dataTransfer.files;
    if (file && !reading && !importing) void readFile(file);
  }

  async function handleImport() {
    if (!review) return;
    const byPk = new Map(review.file.sessions.map((item) => [item.summary.sessionPk, item]));
    const items = matchedImports(review.matching).flatMap(({ sessionId, roundId, pk }) => {
      const session = byPk.get(pk);
      return session ? [{ sessionId, roundId, session }] : [];
    });
    setImporting(true);
    let saved: number;
    try {
      saved = await importMantis(items);
    } catch {
      setImporting(false);
      toast.show({
        message: 'No se pudo importar. Revisá la conexión y volvé a intentar.',
        tone: 'error',
      });
      return;
    }
    leaving.current = true;
    toast.show({
      message:
        saved === 1 ? 'Se importó 1 ronda de MantisX' : `Se importaron ${saved} rondas de MantisX`,
    });
    navigate(SESSIONS_PATH);
  }

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept=".json,application/json"
      aria-label="Archivo exportado de MantisX"
      className="visually-hidden"
      tabIndex={-1}
      onChange={(event) => {
        const [file] = event.target.files ?? [];
        // Se limpia para poder volver a elegir el mismo archivo.
        event.target.value = '';
        if (file) void readFile(file);
      }}
    />
  );

  const errorAlert = error && (
    <Alert title={MANTIS_IMPORT_ERRORS[error].title}>{MANTIS_IMPORT_ERRORS[error].text}</Alert>
  );

  const breadcrumb = (
    <nav aria-label="Ruta" className={styles.breadcrumb}>
      <ol>
        <li>
          <Link to={SESSIONS_PATH}>Sesiones</Link>
        </li>
        <li aria-current="page">Importar MantisX</li>
      </ol>
    </nav>
  );

  const hasImported = ready?.sessions.some((session) =>
    session.rounds.some((round) => round.mantis),
  );

  // --- Etapa 1: elegir el archivo --------------------------------------------------------------

  if (!review) {
    return (
      <div
        className={cx(styles.screen, styles.pick)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        {isDesktop ? (
          breadcrumb
        ) : (
          <header className={styles.back}>
            <IconButton aria-label="Volver a sesiones" onClick={close}>
              <ChevronLeft aria-hidden="true" />
            </IconButton>
            <span className={styles.backLabel}>Sesiones</span>
          </header>
        )}
        <div className={styles.intro}>
          <h1 className={cx('display', styles.title)}>Importar MantisX</h1>
          <p className={styles.lead}>
            Sumá a tus rondas el puntaje, los tiempos, el diagnóstico y la trayectoria de cada
            disparo que registró tu sensor MantisX.
          </p>
        </div>

        {data.status === 'error' ? (
          <Alert title="No se pudieron cargar las sesiones">
            Revisá la conexión y volvé a intentar.
          </Alert>
        ) : (
          <Card as="section" aria-labelledby="mantis-pick-title" className={styles.pickCard}>
            <FileUp aria-hidden="true" size={32} className={styles.pickIcon} />
            <div className={styles.pickText}>
              <h2 id="mantis-pick-title" className={styles.cardTitle}>
                Elegí el archivo exportado
              </h2>
              <p className={styles.muted}>
                Un archivo <span className="num">.json</span> generado con el marcador "Exportar a
                Range Book". Solo se importan las sesiones de fuego real de "Open Training".
                {isDesktop && ' También podés soltar el archivo sobre esta página.'}
              </p>
            </div>
            <Button
              variant="primary"
              block
              loading={reading || !ready}
              onClick={chooseFile}
              className={styles.pickButton}
            >
              <Upload aria-hidden="true" size={18} />
              Elegir archivo
            </Button>
            {fileInput}
          </Card>
        )}
        {errorAlert}
        {ready && <MantisExportHelp defaultOpen={!hasImported} />}
      </div>
    );
  }

  // --- Etapa 2: revisión -----------------------------------------------------------------------

  const count = matchedImports(review.matching).length;
  const note = omittedNote(review.file.omitted);
  const sessions = ready?.sessions ?? [];
  const lookups = ready?.lookups ?? {
    firearms: [],
    configurations: [],
    ranges: [],
    ammunition: [],
  };
  const variant = isDesktop ? 'table' : 'rows';
  const nothing = review.matching.groups.length === 0;
  const dates = review.file.sessions.map((item) => mantisLocalDate(item.summary));
  const importButton = (
    <Button
      variant="primary"
      block={!isDesktop}
      disabled={count === 0}
      loading={importing}
      onClick={() => void handleImport()}
    >
      <Check aria-hidden="true" size={18} />
      Importar {roundsLabel(count)}
    </Button>
  );

  function changeFile() {
    setReview(undefined);
    setError(undefined);
  }

  const content = (
    <div className={styles.reviewMain}>
      {errorAlert}
      {nothing ? (
        <EmptyState
          icon={<FileUp />}
          title="No hay nada nuevo para importar"
          text="Las sesiones de MantisX del archivo ya están importadas o no tienen una ronda disponible en Range Book."
          action={
            <Button onClick={chooseFile} loading={reading}>
              <Upload aria-hidden="true" size={18} />
              Elegir otro archivo
            </Button>
          }
        />
      ) : (
        <MantisMatchList
          matching={review.matching}
          summaries={review.summaries}
          sessions={sessions}
          lookups={lookups}
          variant={variant}
          onAssign={(pk, roundId) =>
            setReview({ ...review, matching: assignRound(review.matching, pk, roundId) })
          }
        />
      )}
      <MantisSkippedList
        matching={review.matching}
        summaries={review.summaries}
        sessions={sessions}
        variant={variant}
      />
      {note && <p className={styles.note}>{note}</p>}
    </div>
  );

  return (
    <div
      className={cx(styles.screen, !isDesktop && !nothing && styles.withActions)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      {fileInput}
      {isDesktop ? (
        breadcrumb
      ) : (
        <header className={styles.back}>
          <IconButton aria-label="Volver a elegir el archivo" onClick={changeFile}>
            <ChevronLeft aria-hidden="true" />
          </IconButton>
          <span className={styles.backLabel}>Importar MantisX</span>
        </header>
      )}

      <div className={styles.reviewHeader}>
        <div className={styles.intro}>
          <h1 className={cx('display', styles.title)}>Revisá la importación</h1>
          {!isDesktop && (
            <div className={styles.fileRow}>
              <span className={cx('num', styles.fileName)}>{review.fileName}</span>
              <button type="button" className={styles.textButton} onClick={changeFile}>
                Cambiar archivo
              </button>
            </div>
          )}
          {!nothing && (
            <p className={styles.lead}>
              Propusimos una ronda para cada sesión de MantisX según la hora. Cambiá la que no
              corresponda.
            </p>
          )}
        </div>
        {isDesktop && !nothing && importButton}
      </div>

      {isDesktop ? (
        <div className={styles.columns}>
          {content}
          <aside className={styles.aside} aria-label="Archivo">
            <Card as="section" aria-labelledby="mantis-file-title" className={styles.fileCard}>
              <span id="mantis-file-title" className="eyebrow">
                Archivo
              </span>
              <span className={cx('num', styles.fileNameWide)}>{review.fileName}</span>
              <span className={styles.muted}>
                {review.file.sessions.length === 1
                  ? '1 sesión de MantisX'
                  : `${review.file.sessions.length} sesiones de MantisX`}{' '}
                · del {formatNumericDayMonth(dates[0] ?? '')} al{' '}
                {formatNumericDayMonth(dates.at(-1) ?? '')}
              </span>
              <Button variant="ghost" onClick={chooseFile} loading={reading}>
                <Upload aria-hidden="true" size={18} />
                Elegir otro archivo
              </Button>
              <span className={styles.small}>
                También podés arrastrar el archivo a esta página.
              </span>
            </Card>
            <MantisExportHelp compact />
          </aside>
        </div>
      ) : (
        content
      )}

      {!isDesktop && !nothing && <div className={styles.actions}>{importButton}</div>}

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="¿Descartar la importación?"
        description="Las sesiones de MantisX del archivo no se van a importar."
        confirmLabel="Descartar"
        cancelLabel="Seguir revisando"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => {
          leaving.current = true;
          blocker.proceed?.();
        }}
      />
    </div>
  );
}
