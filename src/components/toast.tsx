import { CircleAlert, CircleCheck } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { TOAST_DURATION_MS, type ToastOptions } from '@/hooks/use-toast';
import { cx } from '@/lib/cx';
import styles from './toast.module.css';

export interface ToastProps extends ToastOptions {
  onDismiss: () => void;
}

/** Aviso breve. Se cierra solo a los 4 s; se muestra dentro de `ToastProvider`. */
export function Toast({ message, tone = 'success', action, onDismiss }: ToastProps) {
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });
  useEffect(() => {
    const timer = window.setTimeout(() => dismissRef.current(), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const Icon = tone === 'error' ? CircleAlert : CircleCheck;
  return (
    <div className={cx(styles.toast, styles[tone])}>
      <Icon className={styles.icon} aria-hidden="true" />
      <span className={styles.message}>{message}</span>
      {action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            action.onAction();
            onDismiss();
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
