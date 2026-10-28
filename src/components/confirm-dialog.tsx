import { useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useModal } from '@/hooks/use-modal';
import { Button } from './button';
import styles from './confirm-dialog.module.css';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

/** Confirmación de una acción destructiva. El foco arranca en Cancelar. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const ref = useModal<HTMLDivElement>(open, onCancel);

  if (!open) return null;

  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.scrim} aria-hidden="true" onClick={onCancel} />
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={styles.dialog}
      >
        <h2 id={titleId} className={`display ${styles.title}`}>
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className={styles.description}>
            {description}
          </p>
        )}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onCancel} data-autofocus>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
