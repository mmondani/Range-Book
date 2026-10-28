/** Foto guardada en el dispositivo hasta que se suba a Storage. */
export interface PendingUpload {
  path: string;
  blob: Blob;
  /** Milisegundos desde 1970, para subirlas en el orden en que se guardaron. */
  createdAt: number;
}

/** Dónde se guardan las pendientes (IndexedDB en la app, memoria en los tests). */
export interface UploadStore {
  put(upload: PendingUpload): Promise<void>;
  get(path: string): Promise<PendingUpload | undefined>;
  delete(path: string): Promise<void>;
  list(): Promise<PendingUpload[]>;
}

export interface UploadQueueOptions {
  store: UploadStore;
  /** Sube a Storage. */
  upload(path: string, blob: Blob): Promise<void>;
  /** Por defecto, `navigator.onLine`. */
  isOnline?: () => boolean;
  now?: () => number;
}

export interface UploadQueue {
  /**
   * Guarda la foto en la cola y la intenta subir. Resuelve cuando se subió o, si no hay conexión
   * o la red falla, cuando quedó en la cola. Si Storage la rechaza (por ejemplo, por permisos),
   * la saca de la cola y falla, para que el formulario lo avise.
   */
  upload(path: string, blob: Blob): Promise<void>;
  /**
   * Sube las pendientes cuyo path cumple `accept` (las del usuario con sesión). Las que fallan
   * quedan para el próximo intento. Si ya hay una pasada en curso, devuelve esa.
   */
  flush(accept?: (path: string) => boolean): Promise<void>;
  /** La foto si todavía no se subió, para mostrarla o analizarla desde el dispositivo. */
  pending(path: string): Promise<Blob | undefined>;
  /** Saca la foto de la cola sin subirla (se quitó del formulario o se borró su dueño). */
  discard(path: string): Promise<void>;
}

/** Errores de Storage que dependen de la red: la foto queda en la cola para reintentar. */
const RETRYABLE_CODES = new Set([
  'storage/retry-limit-exceeded',
  'storage/unknown',
  'storage/canceled',
  'storage/server-file-wrong-size',
]);

export function isRetryableUploadError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code !== 'string' || RETRYABLE_CODES.has(code);
}

export function createUploadQueue({
  store,
  upload,
  isOnline = () => navigator.onLine,
  now = Date.now,
}: UploadQueueOptions): UploadQueue {
  let flushing: Promise<void> | undefined;

  async function send(item: PendingUpload): Promise<void> {
    await upload(item.path, item.blob);
    await store.delete(item.path);
  }

  return {
    async upload(path, blob) {
      const item = { path, blob, createdAt: now() };
      await store.put(item);
      if (!isOnline()) return;
      try {
        await send(item);
      } catch (error) {
        if (!isOnline() || isRetryableUploadError(error)) return;
        await store.delete(path);
        throw error;
      }
    },

    flush(accept = () => true) {
      flushing ??= (async () => {
        try {
          const items = (await store.list())
            .filter((item) => accept(item.path))
            .sort((a, b) => a.createdAt - b.createdAt);
          for (const item of items) {
            if (!isOnline()) return;
            await send(item).catch(() => {});
          }
        } finally {
          flushing = undefined;
        }
      })();
      return flushing;
    },

    async pending(path) {
      return (await store.get(path))?.blob;
    },

    discard(path) {
      return store.delete(path);
    },
  };
}
