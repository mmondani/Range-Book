import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { SegmentedControl } from '@/components/segmented-control';
import { cx } from '@/lib/cx';
import type { OpenFolder, SaveState } from '../hooks/use-dataset-folder';
import { usePhotoSource } from '../hooks/use-photo-source';
import {
  setPhotoStatus,
  updatePhoto,
  upsertTarget,
  type Dataset,
  type PhotoChanges,
} from '../lib/dataset';
import type { ToolServices } from '../services';
import { EvaluationView } from './evaluation-view';
import { PhotoArea } from './photo-area';
import { PhotoDetails } from './photo-details';
import { PhotoList } from './photo-list';
import { TargetPaste } from './target-paste';
import styles from './tool.module.css';

const VIEW_OPTIONS = [
  { value: 'label', label: 'Marcar' },
  { value: 'evaluate', label: 'Evaluar' },
] as const;

const SAVE_LABELS: Record<SaveState, string> = {
  saved: 'Guardado',
  saving: 'Guardando…',
  error: 'No se pudo guardar dataset.json',
};

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && target.closest('input, textarea, select') !== null;

export interface WorkspaceProps {
  opened: OpenFolder;
  saveState: SaveState;
  notice?: string;
  onUpdate: (change: (dataset: Dataset) => Dataset) => void;
  onAddFiles: (files: File[]) => void;
  services: ToolServices;
}

/** Set abierto: lista de fotos, la foto elegida con sus datos y la evaluación. */
export function Workspace({
  opened,
  saveState,
  notice,
  onUpdate,
  onAddFiles,
  services,
}: WorkspaceProps) {
  const { folder, dataset, missing } = opened;
  const [view, setView] = useState<'label' | 'evaluate'>('label');
  const [chosen, setChosen] = useState<string>();
  const [dropping, setDropping] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const photos = dataset.photos;
  const photo = photos.find((item) => item.file === chosen) ?? photos[0];
  const target = dataset.targets.find((item) => item.id === photo?.targetId);
  const source = usePhotoSource(folder, photo?.file);

  // Página anterior / siguiente pasan de foto (salvo mientras se escribe en un campo).
  const move = useRef<(step: number) => void>(() => {});
  useEffect(() => {
    move.current = (step) => {
      const index = photos.findIndex((item) => item.file === photo?.file);
      const next = photos[index + step];
      if (next) setChosen(next.file);
    };
  });
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key !== 'PageDown' && event.key !== 'PageUp') return;
      if (isTyping(event.target)) return;
      event.preventDefault();
      move.current(event.key === 'PageDown' ? 1 : -1);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  function changePhoto(changes: PhotoChanges) {
    if (!photo) return;
    onUpdate((current) => {
      const next = { ...changes };
      // Al cambiar a un blanco de otro tipo, la calibración ya no sirve.
      if (changes.targetId !== undefined && photo.calibration) {
        const scoring = current.targets.find((item) => item.id === changes.targetId)?.scoring;
        const kind = scoring === 'rings' ? 'ring' : 'points';
        if (photo.calibration.kind !== kind) next.calibration = null;
      }
      return updatePhoto(current, photo.file, next);
    });
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDropping(false);
    onAddFiles([...event.dataTransfer.files]);
  }

  return (
    <div
      className={dropping ? styles.dropping : undefined}
      onDragOver={(event) => {
        event.preventDefault();
        setDropping(true);
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={handleDrop}
    >
      <header className={styles.header}>
        <h1 className={styles.title}>Calibración · {folder.name}</h1>
        <SegmentedControl
          aria-label="Vista"
          options={VIEW_OPTIONS}
          value={view}
          onChange={setView}
        />
        <Button onClick={() => input.current?.click()}>Agregar fotos</Button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          aria-label="Fotos para agregar"
          onChange={(event) => {
            onAddFiles([...(event.target.files ?? [])]);
            event.target.value = '';
          }}
        />
        <span role="status" className={saveState === 'error' ? styles.error : styles.muted}>
          {SAVE_LABELS[saveState]}
        </span>
      </header>
      {notice && (
        <div className={styles.row} style={{ padding: '0 16px' }}>
          <Alert tone="warning" title={notice} />
        </div>
      )}

      {view === 'evaluate' ? (
        <EvaluationView dataset={dataset} folder={folder} detect={services.detectInPhoto} />
      ) : photos.length === 0 ? (
        <main className={styles.gate}>
          <p className={styles.muted}>
            La carpeta no tiene fotos. Agregalas con el botón o arrastrándolas a la ventana.
          </p>
        </main>
      ) : (
        <main className={styles.workspace}>
          <div className={styles.areaList}>
            <PhotoList
              photos={photos}
              missing={missing}
              selected={photo?.file}
              onSelect={setChosen}
            />
          </div>
          {photo && (
            <>
              <PhotoArea
                photo={photo}
                target={target}
                source={source}
                onChange={changePhoto}
                services={services}
              />
              <div className={cx(styles.panel, styles.areaSide)}>
                <PhotoDetails
                  photo={photo}
                  targets={dataset.targets}
                  onChange={changePhoto}
                  onStatus={(status) =>
                    onUpdate((current) => setPhotoStatus(current, photo.file, status))
                  }
                />
                <TargetPaste
                  onTarget={(definition) =>
                    onUpdate((current) => {
                      const added = upsertTarget(current, definition);
                      const own = current.photos.find((item) => item.file === photo.file);
                      return own && !own.targetId
                        ? updatePhoto(added.dataset, photo.file, { targetId: added.id })
                        : added.dataset;
                    })
                  }
                />
              </div>
            </>
          )}
        </main>
      )}
    </div>
  );
}
