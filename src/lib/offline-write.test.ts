import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settleWrite } from './offline-write';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('settleWrite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sin conexión da la escritura por guardada al instante', async () => {
    const write = deferred();
    const done = vi.fn();
    settleWrite(write.promise, { isOnline: () => false }).then(done);
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toHaveBeenCalled();
  });

  it('con conexión espera la confirmación del servidor', async () => {
    const write = deferred();
    const done = vi.fn();
    settleWrite(write.promise, { isOnline: () => true, timeoutMs: 1000 }).then(done);
    await vi.advanceTimersByTimeAsync(500);
    expect(done).not.toHaveBeenCalled();
    write.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toHaveBeenCalled();
  });

  it('con conexión, un error del servidor se propaga', async () => {
    const write = deferred();
    const result = settleWrite(write.promise, { isOnline: () => true });
    write.reject(new Error('permission-denied'));
    await expect(result).rejects.toThrow('permission-denied');
  });

  it('si el servidor tarda, la da por guardada y avisa el error que llegue después', async () => {
    const write = deferred();
    const onLateError = vi.fn();
    const done = vi.fn();
    settleWrite(write.promise, { isOnline: () => true, timeoutMs: 1000, onLateError }).then(done);
    await vi.advanceTimersByTimeAsync(1000);
    expect(done).toHaveBeenCalled();

    const error = new Error('permission-denied');
    write.reject(error);
    await vi.advanceTimersByTimeAsync(0);
    expect(onLateError).toHaveBeenCalledWith(error);
  });

  it('sin conexión, el error que llegue al sincronizar no rompe nada y se avisa', async () => {
    const write = deferred();
    const onLateError = vi.fn();
    await settleWrite(write.promise, { isOnline: () => false, onLateError });
    write.reject(new Error('permission-denied'));
    await vi.advanceTimersByTimeAsync(0);
    expect(onLateError).toHaveBeenCalledOnce();
  });
});
