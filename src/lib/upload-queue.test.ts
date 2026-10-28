import { describe, expect, it, vi } from 'vitest';
import {
  createUploadQueue,
  isRetryableUploadError,
  type PendingUpload,
  type UploadStore,
} from './upload-queue';

function memoryStore(): UploadStore & { items: Map<string, PendingUpload> } {
  const items = new Map<string, PendingUpload>();
  return {
    items,
    put: async (upload) => void items.set(upload.path, upload),
    get: async (path) => items.get(path),
    delete: async (path) => void items.delete(path),
    list: async () => [...items.values()],
  };
}

function setup({ online = true } = {}) {
  const store = memoryStore();
  const state = { online };
  const uploaded: string[] = [];
  const upload = vi.fn(async (path: string) => {
    if (!state.online) throw Object.assign(new Error('offline'), { code: 'storage/unknown' });
    uploaded.push(path);
  });
  let time = 0;
  const queue = createUploadQueue({
    store,
    upload,
    isOnline: () => state.online,
    now: () => ++time,
  });
  return { queue, store, state, upload, uploaded };
}

const photo = (name = 'foto') => new Blob([name], { type: 'image/jpeg' });

describe('createUploadQueue', () => {
  it('con conexión sube la foto y no la deja en la cola', async () => {
    const { queue, store, uploaded } = setup();
    await queue.upload('users/u1/sessions/s1/a.jpg', photo());
    expect(uploaded).toEqual(['users/u1/sessions/s1/a.jpg']);
    expect(store.items.size).toBe(0);
  });

  it('sin conexión la deja en la cola sin intentar subirla', async () => {
    const { queue, store, upload } = setup({ online: false });
    await queue.upload('users/u1/sessions/s1/a.jpg', photo());
    expect(upload).not.toHaveBeenCalled();
    expect(store.items.has('users/u1/sessions/s1/a.jpg')).toBe(true);
  });

  it('si la red falla al subir, la deja en la cola sin fallar', async () => {
    const { queue, store, upload } = setup();
    upload.mockRejectedValueOnce(
      Object.assign(new Error('timeout'), { code: 'storage/retry-limit-exceeded' }),
    );
    await expect(queue.upload('users/u1/rounds/r1/a.jpg', photo())).resolves.toBeUndefined();
    expect(store.items.has('users/u1/rounds/r1/a.jpg')).toBe(true);
  });

  it('si Storage la rechaza, la saca de la cola y falla', async () => {
    const { queue, store, upload } = setup();
    upload.mockRejectedValueOnce(
      Object.assign(new Error('denied'), { code: 'storage/unauthorized' }),
    );
    await expect(queue.upload('users/u1/rounds/r1/a.jpg', photo())).rejects.toThrow('denied');
    expect(store.items.size).toBe(0);
  });

  it('muestra la foto pendiente desde la cola hasta que se sube', async () => {
    const { queue, state } = setup({ online: false });
    const blob = photo('pendiente');
    await queue.upload('users/u1/targets/t1/a.jpg', blob);
    expect(await queue.pending('users/u1/targets/t1/a.jpg')).toBe(blob);

    state.online = true;
    await queue.flush();
    expect(await queue.pending('users/u1/targets/t1/a.jpg')).toBeUndefined();
  });

  it('al volver la conexión sube las pendientes en el orden en que se guardaron', async () => {
    const { queue, store, state, uploaded } = setup({ online: false });
    await queue.upload('users/u1/sessions/s1/b.jpg', photo());
    await queue.upload('users/u1/sessions/s1/a.jpg', photo());

    state.online = true;
    await queue.flush();
    expect(uploaded).toEqual(['users/u1/sessions/s1/b.jpg', 'users/u1/sessions/s1/a.jpg']);
    expect(store.items.size).toBe(0);
  });

  it('solo sube las que acepta el filtro (las del usuario con sesión)', async () => {
    const { queue, store, state, uploaded } = setup({ online: false });
    await queue.upload('users/u1/sessions/s1/a.jpg', photo());
    await queue.upload('users/u2/sessions/s2/b.jpg', photo());

    state.online = true;
    await queue.flush((path) => path.startsWith('users/u1/'));
    expect(uploaded).toEqual(['users/u1/sessions/s1/a.jpg']);
    expect([...store.items.keys()]).toEqual(['users/u2/sessions/s2/b.jpg']);
  });

  it('las que fallan al sincronizar quedan para el próximo intento, sin frenar al resto', async () => {
    const { queue, store, state, upload, uploaded } = setup({ online: false });
    await queue.upload('users/u1/sessions/s1/a.jpg', photo());
    await queue.upload('users/u1/sessions/s1/b.jpg', photo());

    state.online = true;
    upload.mockRejectedValueOnce(new Error('falló'));
    await queue.flush();
    expect(uploaded).toEqual(['users/u1/sessions/s1/b.jpg']);
    expect([...store.items.keys()]).toEqual(['users/u1/sessions/s1/a.jpg']);

    await queue.flush();
    expect(store.items.size).toBe(0);
  });

  it('no arranca una segunda pasada mientras hay una en curso', async () => {
    const { queue, state, upload } = setup({ online: false });
    await queue.upload('users/u1/sessions/s1/a.jpg', photo());

    state.online = true;
    await Promise.all([queue.flush(), queue.flush()]);
    expect(upload).toHaveBeenCalledOnce();
  });

  it('una foto descartada no se sube', async () => {
    const { queue, state, upload } = setup({ online: false });
    await queue.upload('users/u1/sessions/s1/a.jpg', photo());
    await queue.discard('users/u1/sessions/s1/a.jpg');

    state.online = true;
    await queue.flush();
    expect(upload).not.toHaveBeenCalled();
  });
});

describe('isRetryableUploadError', () => {
  it('reintenta los errores de red y los desconocidos', () => {
    expect(isRetryableUploadError({ code: 'storage/retry-limit-exceeded' })).toBe(true);
    expect(isRetryableUploadError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('no reintenta los rechazos de Storage', () => {
    expect(isRetryableUploadError({ code: 'storage/unauthorized' })).toBe(false);
    expect(isRetryableUploadError({ code: 'storage/quota-exceeded' })).toBe(false);
  });
});
