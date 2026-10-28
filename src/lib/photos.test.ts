import { describe, expect, it, vi } from 'vitest';
import {
  pendingPhoto,
  photoPath,
  removedPhotos,
  storedPhotos,
  uploadPhotos,
  type PhotoOwner,
} from './photos';

const OWNER: PhotoOwner = { uid: 'ana', kind: 'sessions', docId: 's1' };

describe('photoPath', () => {
  it('arma la ruta bajo la carpeta del usuario y del documento', () => {
    expect(photoPath(OWNER, 'p1')).toBe('users/ana/sessions/s1/p1.jpg');
    expect(photoPath({ uid: 'ana', kind: 'firearms', docId: 'f9' }, 'p2')).toBe(
      'users/ana/firearms/f9/p2.jpg',
    );
  });
});

describe('uploadPhotos', () => {
  it('sube solo las pendientes y devuelve únicamente las rutas, en orden', async () => {
    const blob = new Blob(['jpeg'], { type: 'image/jpeg' });
    const upload = vi.fn().mockResolvedValue(undefined);
    const photos = [
      ...storedPhotos(['users/ana/sessions/s1/vieja.jpg']),
      pendingPhoto(blob, 'poligono.jpg', 'nueva'),
    ];

    const paths = await uploadPhotos(photos, OWNER, { upload });

    expect(paths).toEqual(['users/ana/sessions/s1/vieja.jpg', 'users/ana/sessions/s1/nueva.jpg']);
    expect(paths.every((path) => typeof path === 'string')).toBe(true);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith('users/ana/sessions/s1/nueva.jpg', blob);
  });

  it('si falla una subida, falla todo (no se guarda el documento)', async () => {
    const upload = vi.fn().mockRejectedValue(new Error('sin conexión'));
    await expect(
      uploadPhotos([pendingPhoto(new Blob(['x']), 'a.jpg', 'p1')], OWNER, { upload }),
    ).rejects.toThrow('sin conexión');
  });
});

describe('removedPhotos', () => {
  it('devuelve las rutas guardadas que se quitaron', () => {
    const previous = ['users/ana/sessions/s1/a.jpg', 'users/ana/sessions/s1/b.jpg'];
    const photos = [
      ...storedPhotos(['users/ana/sessions/s1/b.jpg']),
      pendingPhoto(new Blob(['x']), 'c.jpg', 'c'),
    ];
    expect(removedPhotos(previous, photos)).toEqual(['users/ana/sessions/s1/a.jpg']);
  });

  it('no devuelve nada si no se quitó ninguna', () => {
    const previous = ['users/ana/sessions/s1/a.jpg'];
    expect(removedPhotos(previous, storedPhotos(previous))).toEqual([]);
  });
});

describe('pendingPhoto', () => {
  it('genera un id distinto para cada foto', () => {
    const a = pendingPhoto(new Blob(['x']), 'a.jpg');
    const b = pendingPhoto(new Blob(['x']), 'b.jpg');
    expect(a.status === 'pending' && b.status === 'pending' && a.id !== b.id).toBe(true);
  });
});
