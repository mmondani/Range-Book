import { CONDITION_LABELS, TAG_LABELS, type PhotoCondition } from '../lib/dataset';
import { TAG_GROUPS, type EvaluationMetrics, type EvaluationReport } from '../lib/evaluation';
import styles from './tool.module.css';

const percent = new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 1 });
const mm = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

const pct = (value: number | null) => (value === null ? '—' : percent.format(value));
const len = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `${mm.format(value)} mm`;

function center(metrics: EvaluationMetrics) {
  if (metrics.centerPhotos === 0) return '—';
  const missing = metrics.centerMissing ? ` · sin centro en ${metrics.centerMissing}` : '';
  return `${len(metrics.centerMeanErrorMm)}${missing}`;
}

function MetricHeaders() {
  return (
    <>
      <th scope="col">Encontrados</th>
      <th scope="col">Correctas</th>
      <th scope="col">Marcados</th>
      <th scope="col">Detectados</th>
      <th scope="col">Error medio</th>
      <th scope="col">Error máximo</th>
      <th scope="col">Centro</th>
    </>
  );
}

function Cells({ metrics }: { metrics: EvaluationMetrics }) {
  return (
    <>
      <td>{pct(metrics.recall)}</td>
      <td>{pct(metrics.precision)}</td>
      <td>{metrics.truth}</td>
      <td>{metrics.detected}</td>
      <td>{len(metrics.meanErrorMm)}</td>
      <td>{len(metrics.maxErrorMm)}</td>
      <td>{center(metrics)}</td>
    </>
  );
}

const TAG_GROUP_LABELS = { ...TAG_LABELS, untagged: 'Sin etiquetas' };

/** Resultado de una evaluación: el set, cada foto, por etiqueta y por condición. */
export function ResultsTable({ report }: { report: EvaluationReport }) {
  const conditions = Object.entries(report.byCondition) as Array<
    [PhotoCondition, EvaluationMetrics]
  >;
  return (
    <div className={styles.stack}>
      <p className={styles.muted}>
        <b>Encontrados:</b> impactos marcados que se detectaron. <b>Correctas:</b> detecciones que
        son un impacto marcado (a menos de medio agujero). <b>Centro:</b> error medio del centro
        detectado.
      </p>

      <table className={styles.table} aria-label="Set completo">
        <thead>
          <tr>
            <th scope="col">Set</th>
            <MetricHeaders />
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{report.set.photos} fotos</th>
            <Cells metrics={report.set} />
          </tr>
        </tbody>
      </table>

      <h3 className={styles.subtitle}>Por foto</h3>
      <table className={styles.table} aria-label="Por foto">
        <thead>
          <tr>
            <th scope="col">Foto</th>
            <MetricHeaders />
          </tr>
        </thead>
        <tbody>
          {report.photos.map((photo) => (
            <tr key={photo.file}>
              <th scope="row">{photo.file}</th>
              <Cells metrics={photo.metrics} />
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className={styles.subtitle}>Por etiqueta</h3>
      <p className={styles.muted}>
        Solo los impactos encontrados: las detecciones no tienen etiqueta.
      </p>
      <table className={styles.table} aria-label="Por etiqueta">
        <thead>
          <tr>
            <th scope="col">Etiqueta</th>
            <th scope="col">Encontrados</th>
            <th scope="col">Marcados</th>
          </tr>
        </thead>
        <tbody>
          {TAG_GROUPS.map((group) => (
            <tr key={group}>
              <th scope="row">{TAG_GROUP_LABELS[group]}</th>
              <td>{pct(report.byTag[group].recall)}</td>
              <td>{report.byTag[group].truth}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {conditions.length > 0 && (
        <>
          <h3 className={styles.subtitle}>Por condición</h3>
          <table className={styles.table} aria-label="Por condición">
            <thead>
              <tr>
                <th scope="col">Condición</th>
                <MetricHeaders />
              </tr>
            </thead>
            <tbody>
              {conditions.map(([condition, metrics]) => (
                <tr key={condition}>
                  <th scope="row">
                    {CONDITION_LABELS[condition]} ({metrics.photos})
                  </th>
                  <Cells metrics={metrics} />
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {report.failed.length > 0 && (
        <>
          <h3 className={styles.subtitle}>Sin evaluar</h3>
          <ul>
            {report.failed.map(({ file, error }) => (
              <li key={file}>
                {file}: {error}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
