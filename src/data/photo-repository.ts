import { deleteObject, getBlob, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type { PhotoUploader } from '@/lib/photos';
import { firebase } from './firebase';

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
}

const urls = new Map<string, Promise<string>>();

export const firebasePhotoRepository: PhotoRepository = {
  async upload(path, blob) {
    await uploadBytes(ref(firebase().storage, path), blob, {
      contentType: 'image/jpeg',
      // Cada foto tiene un id propio y no se reemplaza: se puede cachear para siempre.
      cacheControl: 'private, max-age=31536000, immutable',
    });
  },

  url(path) {
    let url = urls.get(path);
    if (!url) {
      url = getDownloadURL(ref(firebase().storage, path));
      // Si falla (por ejemplo, sin conexión), el próximo intento vuelve a pedirla.
      url.catch(() => urls.delete(path));
      urls.set(path, url);
    }
    return url;
  },

  blob(path) {
    return getBlob(ref(firebase().storage, path));
  },

  async remove(path) {
    urls.delete(path);
    try {
      await deleteObject(ref(firebase().storage, path));
    } catch (error) {
      if ((error as { code?: string }).code !== 'storage/object-not-found') throw error;
    }
  },
};
