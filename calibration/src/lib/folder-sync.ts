import { isImageFile, type DatasetFolder } from '../data/dataset-folder';
import {
  addPhotos,
  DATASET_FILE,
  emptyDataset,
  parseDataset,
  serializeDataset,
  type Dataset,
  type PhotoFile,
} from './dataset';

/** Tamaño de una foto (con la orientación EXIF aplicada). */
export type MeasureImage = (blob: Blob) => Promise<{ width: number; height: number }>;

export interface OpenedDataset {
  dataset: Dataset;
  /** Fotos del set cuyo archivo ya no está en la carpeta. */
  missing: string[];
  /** Imágenes de la carpeta que no se pudieron leer. */
  unreadable: string[];
}

async function measureFiles(
  names: readonly string[],
  read: (name: string) => Promise<Blob | null>,
  measure: MeasureImage,
) {
  const measured: PhotoFile[] = [];
  const unreadable: string[] = [];
  for (const file of names) {
    try {
      const blob = await read(file);
      if (!blob) throw new Error('No está');
      measured.push({ file, ...(await measure(blob)) });
    } catch {
      unreadable.push(file);
    }
  }
  return { measured, unreadable };
}

/**
 * Abre el set de la carpeta: lee `dataset.json` (o arranca uno vacío) y suma, sin marcar, las
 * imágenes de la carpeta que todavía no están. Si `dataset.json` está dañado no lo abre, para no
 * pisarlo.
 */
export async function openDataset(
  folder: DatasetFolder,
  measure: MeasureImage,
): Promise<OpenedDataset | { error: string }> {
  const file = await folder.readFile(DATASET_FILE);
  let dataset = emptyDataset();
  if (file) {
    const parsed = parseDataset(await file.text());
    if ('error' in parsed) return { error: `${DATASET_FILE}: ${parsed.error}` };
    dataset = parsed.dataset;
  }
  const images = await folder.listImages();
  const known = new Set(dataset.photos.map((photo) => photo.file));
  const { measured, unreadable } = await measureFiles(
    images.filter((name) => !known.has(name)),
    (name) => folder.readFile(name),
    measure,
  );
  const present = new Set(images);
  return {
    dataset: addPhotos(dataset, measured),
    missing: dataset.photos.filter((photo) => !present.has(photo.file)).map((photo) => photo.file),
    unreadable,
  };
}

export interface ImportResult {
  dataset: Dataset;
  /** Archivos que no se agregaron: no son imágenes, ya hay uno con ese nombre o no se leen. */
  skipped: string[];
}

/** Copia a la carpeta las fotos elegidas o arrastradas y las suma al set, sin marcar. */
export async function importPhotos(
  folder: DatasetFolder,
  dataset: Dataset,
  files: readonly File[],
  measure: MeasureImage,
): Promise<ImportResult> {
  const known = new Set(dataset.photos.map((photo) => photo.file));
  const skipped: string[] = [];
  const accepted = new Map<string, File>();
  for (const file of files) {
    if (!isImageFile(file.name) || known.has(file.name)) skipped.push(file.name);
    else {
      known.add(file.name);
      accepted.set(file.name, file);
    }
  }
  const { measured, unreadable } = await measureFiles(
    [...accepted.keys()],
    async (name) => accepted.get(name) ?? null,
    measure,
  );
  for (const { file } of measured) await folder.writeFile(file, accepted.get(file)!);
  return { dataset: addPhotos(dataset, measured), skipped: [...skipped, ...unreadable] };
}

export function saveDataset(folder: DatasetFolder, dataset: Dataset): Promise<void> {
  return folder.writeFile(DATASET_FILE, serializeDataset(dataset));
}
