import { useEffect, useRef, useState } from 'react';
import type { DatasetFolder } from '../data/dataset-folder';
import type { Dataset } from '../lib/dataset';
import { importPhotos, openDataset, saveDataset, type MeasureImage } from '../lib/folder-sync';

/** Espera después del último cambio antes de escribir `dataset.json`. */
export const SAVE_DELAY_MS = 400;

export type SaveState = 'saved' | 'saving' | 'error';

export interface OpenFolder {
  folder: DatasetFolder;
  dataset: Dataset;
  missing: string[];
}

/**
 * Set abierto desde una carpeta. Cada cambio se guarda solo en `dataset.json` (agrupando los
 * cambios seguidos); las escrituras van de a una.
 */
export function useDatasetFolder(measure: MeasureImage) {
  const [opened, setOpened] = useState<OpenFolder | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const current = useRef<OpenFolder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const writing = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => () => clearTimeout(timer.current), []);

  // Cerrar la pestaña con cambios sin escribir avisa.
  useEffect(() => {
    if (saveState !== 'saving') return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  function scheduleSave(next: OpenFolder) {
    clearTimeout(timer.current);
    setSaveState('saving');
    timer.current = setTimeout(() => {
      writing.current = writing.current
        .then(() => saveDataset(next.folder, next.dataset))
        .then(
          () => {
            if (current.current?.dataset === next.dataset) setSaveState('saved');
          },
          () => setSaveState('error'),
        );
    }, SAVE_DELAY_MS);
  }

  function replace(next: OpenFolder) {
    current.current = next;
    setOpened(next);
    scheduleSave(next);
  }

  async function open(folder: DatasetFolder | null) {
    if (!folder) return;
    setOpening(true);
    setError(undefined);
    try {
      const result = await openDataset(folder, measure);
      if ('error' in result) {
        setError(result.error);
        return;
      }
      const { dataset, missing, unreadable } = result;
      setNotice(unreadable.length ? `No se pudieron leer: ${unreadable.join(', ')}` : undefined);
      // Se guarda enseguida para que las fotos nuevas de la carpeta queden en `dataset.json`.
      replace({ folder, dataset, missing });
    } catch {
      setError('No se pudo abrir la carpeta');
    } finally {
      setOpening(false);
    }
  }

  function update(change: (dataset: Dataset) => Dataset) {
    const previous = current.current;
    if (!previous) return;
    const dataset = change(previous.dataset);
    if (dataset !== previous.dataset) replace({ ...previous, dataset });
  }

  async function addFiles(files: readonly File[]) {
    const previous = current.current;
    if (!previous || files.length === 0) return;
    try {
      const result = await importPhotos(previous.folder, previous.dataset, files, measure);
      setNotice(
        result.skipped.length ? `No se agregaron: ${result.skipped.join(', ')}` : undefined,
      );
      // Mientras se copiaban las fotos pudo haber otros cambios: las nuevas se suman a lo último.
      const added = result.dataset.photos.slice(previous.dataset.photos.length);
      update((latest) => ({ ...latest, photos: [...latest.photos, ...added] }));
    } catch {
      setNotice('No se pudieron copiar las fotos a la carpeta');
    }
  }

  return { opened, opening, error, notice, saveState, open, update, addFiles };
}
