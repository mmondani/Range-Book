import type { PendingUpload, UploadStore } from '@/lib/upload-queue';

const DB_NAME = 'rangebook-uploads';
const STORE = 'uploads';

let database: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'path' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
  });
  return database;
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    // Se resuelve al terminar la transacción, así lo escrito ya está guardado en disco.
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

/** Fotos pendientes de subir, en IndexedDB: sobreviven a cerrar la app. */
export const indexedDbUploadStore: UploadStore = {
  async put(upload) {
    await run('readwrite', (store) => store.put(upload));
  },
  get(path) {
    return run('readonly', (store) => store.get(path) as IDBRequest<PendingUpload | undefined>);
  },
  async delete(path) {
    await run('readwrite', (store) => store.delete(path));
  },
  list() {
    return run('readonly', (store) => store.getAll() as IDBRequest<PendingUpload[]>);
  },
};
