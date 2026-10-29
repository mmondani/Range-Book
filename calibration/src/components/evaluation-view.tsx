import { useState } from 'react';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import type { DatasetFolder } from '../data/dataset-folder';
import { evaluablePhotos, type Dataset } from '../lib/dataset';
import { reportPath, type EvaluationReport } from '../lib/evaluation';
import { evaluateDataset, type EvaluationRun } from '../lib/evaluation-runner';
import { parseTuning, tuningValues, type TuningValues } from '../lib/tuning';
import { ParameterForm } from './parameter-form';
import { ResultsTable } from './results-table';
import styles from './tool.module.css';

export interface EvaluationViewProps {
  dataset: Dataset;
  folder: DatasetFolder;
  detect: EvaluationRun['detect'];
  now?: () => Date;
}

/** Imprime el reporte en la consola, para copiarlo o compararlo con otra corrida. */
function logReport(report: EvaluationReport, path: string) {
  console.info(`Evaluación de la detección (${path})`, report.tuning);
  console.table([{ foto: 'Set', ...report.set }]);
  console.table(report.photos.map(({ file, metrics }) => ({ foto: file, ...metrics })));
  console.table(report.byTag);
  console.table(report.byCondition);
}

/**
 * Evalúa la detección actual (o con otros parámetros) contra las fotos listas del set. El
 * resultado se ve acá, se imprime en la consola y se guarda en `resultados/` de la carpeta.
 */
export function EvaluationView({ dataset, folder, detect, now }: EvaluationViewProps) {
  const [values, setValues] = useState<TuningValues>(() => tuningValues());
  const [progress, setProgress] = useState<{ done: number; total: number }>();
  const [report, setReport] = useState<EvaluationReport>();
  const [saved, setSaved] = useState<string>();
  const [error, setError] = useState<string>();
  const parsed = parseTuning(values);
  const errors = 'errors' in parsed ? parsed.errors : [];
  const count = evaluablePhotos(dataset).length;
  const running = progress !== undefined;

  async function run() {
    if (!('tuning' in parsed)) return;
    setError(undefined);
    setSaved(undefined);
    setProgress({ done: 0, total: count });
    try {
      const result = await evaluateDataset(dataset, {
        readPhoto: (file) => folder.readFile(file),
        detect,
        tuning: parsed.tuning,
        onProgress: (done, total) => setProgress({ done, total }),
        now,
      });
      setReport(result);
      const path = reportPath(new Date(result.createdAt));
      logReport(result, path);
      try {
        await folder.writeFile(path, `${JSON.stringify(result, null, 2)}\n`);
        setSaved(path);
      } catch {
        setError('No se pudo guardar el resultado en la carpeta');
      }
    } finally {
      setProgress(undefined);
    }
  }

  return (
    <main className={styles.evaluation}>
      <ParameterForm values={values} errors={errors} onChange={setValues} />
      <div className={styles.row}>
        <Button
          variant="primary"
          onClick={() => void run()}
          loading={running}
          disabled={count === 0 || errors.length > 0}
        >
          Evaluar {count} {count === 1 ? 'foto lista' : 'fotos listas'}
        </Button>
        {running && (
          <span role="status" className={styles.muted}>
            Evaluando {progress.done} de {progress.total}…
          </span>
        )}
        {saved && (
          <span role="status" className={styles.muted}>
            Guardado en <code>{saved}</code> (y en la consola)
          </span>
        )}
      </div>
      {count === 0 && (
        <p className={styles.muted}>Se evalúan las fotos marcadas como listas, con calibración.</p>
      )}
      {error && <Alert title={error} />}
      {report && <ResultsTable report={report} />}
    </main>
  );
}
