/**
 * Carpeta del set de fotos, con la API de acceso a archivos de Chrome: las fotos, `dataset.json`
 * y los resultados de la evaluación viven ahí. La carpeta elegida se recuerda (IndexedDB) para
 * volver a abrirla después de recargar.
 */

/** Lo que la herramienta necesita de la carpeta. En los tests, una carpeta en memoria. */
export interface DatasetFolder {
  name: string;
  /** Nombres de las imágenes (JPEG, PNG o WebP) en la raíz de la carpeta. */
  listImages(): Promise<string[]>;
  readFile(path: string): Promise<Blob | null>;
  /** Escribe (o reemplaza) un archivo. `path` puede incluir una subcarpeta: `resultados/x.json`. */
  writeFile(path: string, data: Blob | string): Promise<void>;
}

const IMAGE_FILE = /\.(jpe?g|png|webp)$/i;

export const isImageFile = (name: string) => IMAGE_FILE.test(name);

export const supportsFolders = () =>
  typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

async function directoryFor(root: FileSystemDirectoryHandle, path: string, create: boolean) {
  const parts = path.split('/');
  const name = parts.pop()!;
  let directory = root;
  for (const part of parts) directory = await directory.getDirectoryHandle(part, { create });
  return { directory, name };
}

function folderFrom(root: FileSystemDirectoryHandle): DatasetFolder {
  return {
    name: root.name,
    async listImages() {
      const names: string[] = [];
      for await (const entry of root.values()) {
        if (entry.kind === 'file' && isImageFile(entry.name)) names.push(entry.name);
      }
      return names.sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    },
    async readFile(path) {
      try {
        const { directory, name } = await directoryFor(root, path, false);
        return await (await directory.getFileHandle(name)).getFile();
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') return null;
        throw error;
      }
    },
    async writeFile(path, data) {
      const { directory, name } = await directoryFor(root, path, true);
      const writable = await (
        await directory.getFileHandle(name, { create: true })
      ).createWritable();
      await writable.write(data);
      await writable.close();
    },
  };
}

// --- Carpeta recordada -----------------------------------------------------------------------

const DB_NAME = 'rangebook-calibration';
const STORE = 'folders';
const KEY = 'dataset';

function request<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const transaction = open.result.transaction(STORE, mode);
      const result = action(transaction.objectStore(STORE));
      transaction.oncomplete = () => {
        open.result.close();
        resolve(result.result);
      };
      transaction.onerror = () => reject(transaction.error);
    };
  });
}

/** Pide al usuario la carpeta del set y la recuerda. */
export async function pickFolder(): Promise<DatasetFolder | null> {
  if (!window.showDirectoryPicker) throw new Error('Este navegador no permite abrir carpetas');
  try {
    const root = await window.showDirectoryPicker({ id: 'rangebook-dataset', mode: 'readwrite' });
    await request('readwrite', (store) => store.put(root, KEY));
    return folderFrom(root);
  } catch (error) {
    // El usuario cerró el diálogo.
    if (error instanceof DOMException && error.name === 'AbortError') return null;
    throw error;
  }
}

/** La carpeta abierta la última vez, si la hay. Volver a abrirla pide permiso (con un clic). */
export async function rememberedFolder(): Promise<{
  name: string;
  reopen: () => Promise<DatasetFolder | null>;
} | null> {
  const root = await request<FileSystemDirectoryHandle | undefined>('readonly', (store) =>
    store.get(KEY),
  ).catch(() => undefined);
  if (!root) return null;
  return {
    name: root.name,
    async reopen() {
      const mode = { mode: 'readwrite' } as const;
      const granted =
        (await root.queryPermission(mode)) === 'granted' ||
        (await root.requestPermission(mode)) === 'granted';
      return granted ? folderFrom(root) : null;
    },
  };
}

/** Tamaño de una foto con la orientación EXIF aplicada, como la ve la app. */
export async function measureImage(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}
