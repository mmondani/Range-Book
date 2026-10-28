import { vi } from 'vitest';
import type { PhotoRepository } from '@/data/photo-repository';

/** Doble de Storage: las fotos guardadas se sirven desde `https://storage.test/<ruta>`. */
export function createFakePhotos({ missing = [] as string[] } = {}) {
  const stored = new Map<string, Blob>();
  const repository: PhotoRepository = {
    upload: vi.fn(async (path: string, blob: Blob) => {
      stored.set(path, blob);
    }),
    url: vi.fn(async (path: string) => {
      if (missing.includes(path)) throw new Error('storage/object-not-found');
      return `https://storage.test/${path}`;
    }),
    blob: vi.fn(async (path: string) => {
      if (missing.includes(path)) throw new Error('storage/object-not-found');
      return stored.get(path) ?? new Blob(['foto'], { type: 'image/jpeg' });
    }),
    remove: vi.fn(async (path: string) => {
      stored.delete(path);
    }),
  };
  return { repository, stored };
}

/** jsdom no implementa `URL.createObjectURL`. */
export function stubObjectUrls() {
  let next = 0;
  vi.stubGlobal(
    'URL',
    Object.assign(class extends URL {}, {
      createObjectURL: vi.fn(() => `blob:preview-${++next}`),
      revokeObjectURL: vi.fn(),
    }),
  );
}
