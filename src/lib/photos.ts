/** Carpetas de Storage según la entidad dueña de la foto. */
export type PhotoKind = 'firearms' | 'sessions' | 'rounds' | 'targets';

/**
 * Foto en un formulario: ya guardada en Storage (`stored`) o elegida y comprimida pero
 * todavía sin subir (`pending`). En Firestore solo se guarda la ruta de las `stored`.
 */
export type PhotoDraft =
  { status: 'stored'; path: string } | { status: 'pending'; id: string; blob: Blob; name: string };

export interface PhotoOwner {
  uid: string;
  kind: PhotoKind;
  /** Id del documento dueño. Para uno nuevo, se genera antes de guardarlo. */
  docId: string;
}

/** Lo que necesita `uploadPhotos` de Storage. */
export interface PhotoUploader {
  upload(path: string, blob: Blob): Promise<void>;
}

/** `users/{uid}/{kind}/{docId}/{photoId}.jpg`, como piden las reglas de Storage. */
export function photoPath({ uid, kind, docId }: PhotoOwner, photoId: string): string {
  return `users/${uid}/${kind}/${docId}/${photoId}.jpg`;
}

export function storedPhotos(paths: readonly string[]): PhotoDraft[] {
  return paths.map((path) => ({ status: 'stored', path }));
}

export function pendingPhoto(
  blob: Blob,
  name: string,
  id: string = crypto.randomUUID(),
): PhotoDraft {
  return { status: 'pending', id, blob, name };
}

/** Clave estable para listas de React. */
export function photoKey(photo: PhotoDraft): string {
  return photo.status === 'stored' ? photo.path : photo.id;
}

/**
 * Sube las fotos pendientes y devuelve las rutas de todas, en el mismo orden, para guardarlas
 * en el documento. Se llama antes de escribir en Firestore.
 */
export async function uploadPhotos(
  photos: readonly PhotoDraft[],
  owner: PhotoOwner,
  uploader: PhotoUploader,
): Promise<string[]> {
  return Promise.all(
    photos.map(async (photo) => {
      if (photo.status === 'stored') return photo.path;
      const path = photoPath(owner, photo.id);
      await uploader.upload(path, photo.blob);
      return path;
    }),
  );
}

/**
 * Rutas que el documento tenía y ya no: se borran de Storage después de guardarlo, para que
 * un error al guardar no deje el documento apuntando a fotos borradas.
 */
export function removedPhotos(
  previous: readonly string[],
  photos: readonly PhotoDraft[],
): string[] {
  const kept = new Set(photos.flatMap((photo) => (photo.status === 'stored' ? [photo.path] : [])));
  return previous.filter((path) => !kept.has(path));
}
