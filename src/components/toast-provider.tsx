import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ToastContext, type ToastOptions } from '@/hooks/use-toast';
import { Toast } from './toast';
import styles from './toast.module.css';

interface ToastItem extends ToastOptions {
  id: number;
}

let nextId = 1;

/** Muestra los toasts de `useToast` en una región `aria-live` que siempre está presente. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      show: (options: ToastOptions) => {
        const id = nextId++;
        // Uno a la vez: el nuevo reemplaza al anterior.
        setToasts([{ ...options, id }]);
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.region} aria-live="polite" role="status">
        {toasts.map(({ id, ...toast }) => (
          <Toast key={id} {...toast} onDismiss={() => dismiss(id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
