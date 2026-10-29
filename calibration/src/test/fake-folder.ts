import { vi } from 'vitest';
import { isImageFile, type DatasetFolder } from '../data/dataset-folder';

/** Carpeta del set en memoria. */
export function createFakeFolder(initial: Record<string, Blob | string> = {}, name = 'dataset') {
  const files = new Map<string, Blob>(
    Object.entries(initial).map(([path, data]) => [path, new Blob([data])]),
  );
  const folder: DatasetFolder = {
    name,
    listImages: vi.fn(async () =>
      [...files.keys()].filter((path) => !path.includes('/') && isImageFile(path)).sort(),
    ),
    readFile: vi.fn(async (path: string) => files.get(path) ?? null),
    writeFile: vi.fn(async (path: string, data: Blob | string) => {
      files.set(path, new Blob([data]));
    }),
  };
  return {
    folder,
    files,
    text: async (path: string) => (await files.get(path)?.text()) ?? null,
  };
}

/**
 * Imagen falsa: su contenido es el tamaño, `ancho×alto`, así `fakeMeasure` lo lee sin decodificar
 * nada.
 */
export const fakeImage = (width: number, height: number) => `${width}×${height}`;

export async function fakeMeasure(blob: Blob) {
  const match = /^(\d+)×(\d+)$/.exec(await blob.text());
  if (!match) throw new Error('No es una imagen');
  return { width: Number(match[1]), height: Number(match[2]) };
}
