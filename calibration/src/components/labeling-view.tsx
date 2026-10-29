import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/button';
import { CalibrationPanel } from '@/components/calibration-panel';
import { MarkerPicker } from '@/components/marker-picker';
import { SegmentedControl } from '@/components/segmented-control';
import { TargetAnalyzer, type AnalyzerMarker } from '@/components/target-analyzer';
import {
  buildCalibration,
  calibrationDraft,
  calibrationMarkers,
  MARKER_LABELS,
  nextMarker,
  pixelEllipse,
  previewCalibration,
  reshapeDraft,
  type Calibration,
  type CalibrationDraft,
  type CalibrationTool,
  type Pixel,
} from '@/lib/calibration';
import { cx } from '@/lib/cx';
import type { PhotoDraft } from '@/lib/photos';
import {
  IMPACT_TAGS,
  TAG_LABELS,
  type DatasetPhoto,
  type DatasetTarget,
  type PhotoChanges,
} from '../lib/dataset';
import type { PhotoDetection } from '../lib/evaluation-runner';
import {
  addLabeled,
  applyProposal,
  countWarning,
  labelHistory,
  removeLabeled,
  toggleTag,
  undoLabels,
  type LabelHistory,
} from '../lib/labeling';
import styles from './tool.module.css';

type Mode = 'calibrate' | 'add' | 'remove' | 'tag';

const MODE_OPTIONS = [
  { value: 'calibrate', label: 'Calibrar' },
  { value: 'add', label: 'Agregar' },
  { value: 'remove', label: 'Quitar' },
  { value: 'tag', label: 'Etiquetar' },
] as const;

const MODE_HELP: Record<Exclude<Mode, 'calibrate'>, string> = {
  add: 'Tocá el centro de cada agujero de papel roto, no el anillo gris de plomo. Si varios se superponen, marcá uno por bala.',
  remove: 'Tocá un impacto para quitarlo.',
  tag: 'Tocá un impacto para elegirlo y marcá sus etiquetas.',
};

/** La calibración guardada, si es del tipo que pide el blanco. */
function savedCalibration(photo: DatasetPhoto, target: DatasetTarget): Calibration | null {
  const kind = target.scoring === 'rings' ? 'ring' : 'points';
  return photo.calibration?.kind === kind ? photo.calibration : null;
}

function nearest(impacts: readonly Pixel[], at: Pixel): number | null {
  let best: number | null = null;
  let distance = Infinity;
  impacts.forEach((impact, index) => {
    const d = Math.hypot(impact.x - at.x, impact.y - at.y);
    if (d < distance) {
      distance = d;
      best = index;
    }
  });
  return best;
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && target.closest('input, textarea, select') !== null;

export interface LabelingViewProps {
  photo: DatasetPhoto;
  target: DatasetTarget;
  source: PhotoDraft;
  onChange: (changes: PhotoChanges) => void;
  /** Corre la detección actual sobre la foto (con su calibración guardada). */
  onDetect: () => Promise<PhotoDetection>;
}

/**
 * Marcado de una foto: calibración (como en el análisis de la app) e impactos con etiquetas.
 * Todo cambio va al set enseguida. Se monta de nuevo al cambiar de foto o de blanco.
 */
export function LabelingView({ photo, target, source, onChange, onDetect }: LabelingViewProps) {
  const size = { width: photo.width, height: photo.height };
  const [initial] = useState(() => calibrationDraft(target, savedCalibration(photo, target)));
  const [mode, setMode] = useState<Mode>(() =>
    savedCalibration(photo, target) ? 'add' : 'calibrate',
  );
  const [draft, setDraft] = useState<CalibrationDraft>(initial);
  const [active, setActive] = useState<CalibrationTool>(
    () => nextMarker(initial, target.scoring) ?? 'center',
  );
  const [shapeError, setShapeError] = useState<string>();
  // Borrador de antes de empezar a arrastrar, para volver si el gesto era un zoom.
  const dragOrigin = useRef<CalibrationDraft>(undefined);
  const [history, setHistory] = useState(() => labelHistory(photo.impacts));
  const [selected, setSelected] = useState<number | null>(null);
  const [proposal, setProposal] = useState<Pixel[] | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string>();
  const calibrating = mode === 'calibrate';
  const calibration = savedCalibration(photo, target);

  // --- Calibración ---------------------------------------------------------------------------

  /** Cada borrador válido se guarda como la calibración de la foto. */
  function changeDraft(next: CalibrationDraft) {
    setDraft(next);
    setShapeError(undefined);
    const result = buildCalibration(next, target.scoring, size);
    if ('calibration' in result) onChange({ calibration: result.calibration });
  }

  function canReshape() {
    if (draft.center && draft.edge) return true;
    setShapeError('Ubicá el centro y un punto sobre un anillo antes de deformarlos');
    return false;
  }

  function moveMarker(pixel: Pixel) {
    if (active === 'shape' && !canReshape()) return;
    dragOrigin.current ??= draft;
    changeDraft(
      active === 'shape' ? reshapeDraft(dragOrigin.current, pixel) : { ...draft, [active]: pixel },
    );
  }

  function cancelMarkerMove() {
    if (dragOrigin.current) changeDraft(dragOrigin.current);
    dragOrigin.current = undefined;
  }

  function placeMarker(pixel: Pixel) {
    if (active === 'shape') {
      if (!canReshape()) return;
      changeDraft(reshapeDraft(dragOrigin.current ?? draft, pixel));
      dragOrigin.current = undefined;
      return;
    }
    dragOrigin.current = undefined;
    const next = { ...draft, [active]: pixel };
    changeDraft(next);
    const missing = nextMarker(next, target.scoring);
    if (missing) setActive(missing);
  }

  const built = buildCalibration(draft, target.scoring, size);
  const calibrationError =
    shapeError ??
    (nextMarker(draft, target.scoring) === undefined && 'error' in built ? built.error : undefined);

  // --- Impactos ------------------------------------------------------------------------------

  function applyHistory(next: LabelHistory) {
    setHistory(next);
    onChange({ impacts: next.impacts });
  }

  function undo() {
    setSelected(null);
    applyHistory(undoLabels(history));
  }

  // Ctrl + Z deshace (salvo mientras se escribe en un campo).
  const undoRef = useRef(undo);
  useEffect(() => {
    undoRef.current = undo;
  });
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      if (isTyping(event.target)) return;
      event.preventDefault();
      undoRef.current();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  function handlePoint(pixel: Pixel) {
    if (calibrating) placeMarker(pixel);
    else if (mode === 'add') applyHistory(addLabeled(history, pixel));
    else if (mode === 'tag') setSelected(nearest(history.impacts, pixel));
  }

  async function showDetection() {
    setDetecting(true);
    setDetectError(undefined);
    try {
      setProposal((await onDetect()).impacts);
    } catch {
      setDetectError('No se pudo correr la detección sobre esta foto');
    } finally {
      setDetecting(false);
    }
  }

  // --- Vista ---------------------------------------------------------------------------------

  const preview = previewCalibration(draft, target.scoring, size);
  const markers: AnalyzerMarker[] = calibrating
    ? calibrationMarkers(target.scoring).flatMap((marker) => {
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
    : [
        ...(proposal ?? []).map((at, index) => ({ key: `d${index}`, at, text: 'D' })),
        ...(selected !== null && history.impacts[selected]
          ? [{ key: 'selected', at: history.impacts[selected], active: true }]
          : []),
      ];
  const rings =
    calibrating && preview
      ? target.zones.map((zone) => ({
          key: String(zone.diameterMm),
          ...pixelEllipse(preview, zone.diameterMm / 2),
        }))
      : [];
  const line: [Pixel, Pixel] | undefined =
    calibrating && draft.a && draft.b ? [draft.a, draft.b] : undefined;
  const impactLabel = (index: number) => {
    const tags = history.impacts[index]?.tags ?? [];
    const suffix = tags.length ? ` (${tags.map((tag) => TAG_LABELS[tag]).join(', ')})` : '';
    return `Impacto ${index + 1}${suffix}`;
  };
  const warning = countWarning(history.impacts.length, photo.shots);
  const current = selected !== null ? history.impacts[selected] : undefined;

  return (
    <>
      <section aria-label="Foto" className={cx(styles.stack, styles.areaPhoto)}>
        <div className={styles.row}>
          <SegmentedControl
            aria-label="Modo"
            options={MODE_OPTIONS}
            value={mode}
            onChange={(next) => {
              setMode(next);
              setSelected(null);
            }}
          />
          {!calibrating && (
            <Button variant="ghost" onClick={undo} disabled={history.past.length === 0}>
              Deshacer
            </Button>
          )}
        </div>
        <TargetAnalyzer
          photo={source}
          alt={`Foto ${photo.file}`}
          size={size}
          onSize={() => {}}
          pointLabel={
            calibrating
              ? active === 'shape'
                ? 'Deformar los anillos hacia el punto indicado'
                : `Ubicar ${MARKER_LABELS[active].toLocaleLowerCase('es-AR')} en el punto indicado`
              : mode === 'add'
                ? 'Agregar impacto en el punto indicado'
                : mode === 'tag'
                  ? 'Elegir el impacto más cercano al punto indicado'
                  : undefined
          }
          onPoint={handlePoint}
          onPointMove={calibrating ? moveMarker : undefined}
          onPointCancel={cancelMarkerMove}
          markers={markers}
          rings={rings}
          line={line}
          impacts={history.impacts}
          impactLabel={impactLabel}
          onRemoveImpact={
            mode === 'remove'
              ? (index) => {
                  setSelected(null);
                  applyHistory(removeLabeled(history, index));
                }
              : undefined
          }
          controls={
            calibrating && (
              <MarkerPicker
                scoring={target.scoring}
                draft={draft}
                active={active}
                onActive={setActive}
              />
            )
          }
          busy={detecting ? 'Detectando impactos…' : undefined}
        />
      </section>

      <section aria-label="Marcado" className={cx(styles.panel, styles.areaMarking)}>
        {calibrating ? (
          <CalibrationPanel
            scoring={target.scoring}
            zones={target.zones}
            draft={draft}
            active={active}
            onChange={(changes) => changeDraft({ ...draft, ...changes })}
            error={calibrationError}
          />
        ) : (
          <>
            <p className={styles.muted}>{MODE_HELP[mode]}</p>
            <p role="status">
              {history.impacts.length} impactos marcados
              {photo.shots !== null && ` de ${photo.shots} disparos`}
            </p>
            {warning && <p className={styles.warning}>{warning}</p>}

            {mode === 'tag' &&
              (current ? (
                <fieldset className={styles.checks}>
                  <legend>Impacto {selected! + 1}</legend>
                  {IMPACT_TAGS.map((tag) => (
                    <label key={tag} className={styles.check}>
                      <input
                        type="checkbox"
                        checked={current.tags.includes(tag)}
                        onChange={() => applyHistory(toggleTag(history, selected!, tag))}
                      />
                      {TAG_LABELS[tag]}
                    </label>
                  ))}
                </fieldset>
              ) : (
                <p className={styles.muted}>Ningún impacto elegido.</p>
              ))}

            <div className={styles.stack}>
              {proposal ? (
                <>
                  <p role="status" className={styles.muted}>
                    La detección actual propone {proposal.length} impactos (marcados con «D»).
                  </p>
                  <div className={styles.row}>
                    <Button
                      onClick={() => {
                        applyHistory(applyProposal(history, proposal));
                        setProposal(null);
                      }}
                    >
                      Usar como punto de partida
                    </Button>
                    <Button variant="ghost" onClick={() => setProposal(null)}>
                      Ocultar
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  onClick={() => void showDetection()}
                  loading={detecting}
                  disabled={!calibration}
                >
                  Ver la detección actual
                </Button>
              )}
              {detectError && <p className={styles.error}>{detectError}</p>}
            </div>
          </>
        )}
      </section>
    </>
  );
}
