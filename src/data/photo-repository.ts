import { deleteObject, getBlob, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type { PhotoUploader } from '@/lib/photos';
import { createUploadQueue } from '@/lib/upload-queue';
import { firebase } from './firebase';
import { indexedDbUploadStore } from './upload-store';

export interface PhotoRepository extends PhotoUploader {
  /** URL para mostrar la foto. Se cachea: la ruta de una foto nunca cambia de contenido. */
  url(path: string): Promise<string>;
  /**
   * Contenido de la foto, para leer sus píxeles (detección de impactos). Necesita que el bucket
   * tenga CORS configurado para el dominio de la app.
   */
  blob(path: string): Promise<Blob>;
  /** Borra la foto; si ya no existe, no falla. */
  remove(path: string): Promise<void>;
  /** Sube las fotos del usuario que quedaron pendientes (sin conexión). */
  syncPending(uid: string): Promise<void>;
}

// Las fotos pasan siempre por la cola: si no hay conexión, quedan en el dispositivo y el
// documento ya guarda su ruta. Se suben al volver la conexión (`syncPending`).
const queue = createUploadQueue({
  store: indexedDbUploadStore,
  async upload(path, blob) {
    await uploadBytes(ref(firebase().storage, path), blob, {
      contentType: 'image/jpeg',
      // Cada foto tiene un id propio y no se reemplaza: se puede cachear para siempre.
      cacheControl: 'private, max-age=31536000, immutable',
    });
  },
});

const urls = new Map<string, Promise<string>>();

// Las URLs de descarga se guardan también en `localStorage`: sin conexión no se pueden pedir, y
// el service worker tiene las imágenes en caché por URL.
const SAVED_URLS_KEY = 'rb-photo-urls';

function savedUrls(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SAVED_URLS_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function setSavedUrl(path: string, url: string | undefined): void {
  const saved = savedUrls();
  if (url) saved[path] = url;
  else delete saved[path];
  try {
    localStorage.setItem(SAVED_URLS_KEY, JSON.stringify(saved));
  } catch {
    // Sin lugar: se vuelve a pedir la próxima vez.
  }
}

async function resolveUrl(path: string): Promise<string> {
  const pending = await queue.pending(path);
  if (pending) return URL.createObjectURL(pending);
  const saved = savedUrls()[path];
  if (saved) return saved;
  const url = await getDownloadURL(ref(firebase().storage, path));
  setSavedUrl(path, url);
  return url;
}

export const firebasePhotoRepository: PhotoRepository = {
  upload(path, blob) {
    return queue.upload(path, blob);
  },

  url(path) {
    let url = urls.get(path);
    if (!url) {
      url = resolveUrl(path);
      // Si falla (por ejemplo, sin conexión), el próximo intento vuelve a pedirla.
      url.catch(() => urls.delete(path));
      urls.set(path, url);
    }
    return url;
  },

  async blob(path) {
    return (await queue.pending(path)) ?? getBlob(ref(firebase().storage, path));
  },

  async remove(path) {
    urls.delete(path);
    setSavedUrl(path, undefined);
    await queue.discard(path);
    try {
      await deleteObject(ref(firebase().storage, path));
    } catch (error) {
      if ((error as { code?: string }).code !== 'storage/object-not-found') throw error;
    }
  },

  syncPending(uid) {
    return queue.flush((path) => path.startsWith(`users/${uid}/`));
  },
};
