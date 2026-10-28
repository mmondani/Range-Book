/** Cuánto se espera la confirmación del servidor antes de dar la escritura por guardada. */
export const WRITE_CONFIRM_TIMEOUT_MS = 4000;

export interface SettleWriteOptions {
  /** Por defecto, `navigator.onLine`. */
  isOnline?: () => boolean;
  timeoutMs?: number;
  /** Error que llega después de haber dado la escritura por guardada. */
  onLateError?: (error: unknown) => void;
}

/**
 * Firestore aplica cada escritura al instante en la caché local, pero su promesa resuelve recién
 * cuando la confirma el servidor: sin conexión, un formulario quedaría "guardando" hasta que
 * vuelva. Esto la da por guardada enseguida si no hay conexión, o si el servidor tarda más de
 * `timeoutMs` (conexión mala), y sigue esperándola en segundo plano. Con conexión normal resuelve
 * o falla como la escritura, así los errores (por ejemplo, de permisos) se siguen viendo.
 */
export function settleWrite<T>(write: Promise<T>, options: SettleWriteOptions = {}): Promise<void> {
  const {
    isOnline = () => navigator.onLine,
    timeoutMs = WRITE_CONFIRM_TIMEOUT_MS,
    onLateError = (error) => console.error('Una escritura pendiente falló', error),
  } = options;

  let settled = false;
  const confirmed = write.then(
    () => {
      settled = true;
    },
    (error: unknown) => {
      if (settled) onLateError(error);
      settled = true;
      throw error;
    },
  );
  // Si ya se dio por guardada, el error lo informa `onLateError`.
  confirmed.catch(() => {});

  if (!isOnline()) {
    settled = true;
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      settled = true;
      resolve();
    }, timeoutMs);
    confirmed.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
