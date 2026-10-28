import { X } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useModal } from '@/hooks/use-modal';
import styles from './bottom-sheet.module.css';
import { ConfirmDialog } from './confirm-dialog';
import { IconButton } from './icon-button';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  /**
   * Acciones fijas abajo (por ejemplo, Cancelar / Guardar). Como función recibe `requestClose`,
   * que pide confirmación si hay cambios, igual que el botón cerrar.
   */
  footer?: ReactNode | ((requestClose: () => void) => ReactNode);
  /** Si hay cambios sin guardar, cerrar pide confirmación. */
  dirty?: boolean;
}

/** Sheet desde abajo en mobile y diálogo centrado en desktop. */
export function BottomSheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  dirty = false,
}: BottomSheetProps) {
  const titleId = useId();
  const [confirming, setConfirming] = useState(false);

  function requestClose() {
    if (dirty) setConfirming(true);
    else onClose();
  }

  const ref = useModal<HTMLElement>(open, requestClose);

  if (!open) return null;

  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.scrim} aria-hidden="true" onClick={requestClose} />
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={styles.sheet}
      >
        <div className={styles.grabber} aria-hidden="true">
          <span />
        </div>
        <header className={styles.header}>
          <div className={styles.titles}>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2 id={titleId} className={`display ${styles.title}`}>
              {title}
            </h2>
          </div>
          <IconButton aria-label="Cerrar" onClick={requestClose}>
            <X aria-hidden="true" />
          </IconButton>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && (
          <div className={styles.footer}>
            {typeof footer === 'function' ? footer(requestClose) : footer}
          </div>
        )}
      </section>
      <ConfirmDialog
        open={confirming}
        title="¿Descartar los cambios?"
        description="Los datos que cargaste no se van a guardar."
        confirmLabel="Descartar"
        cancelLabel="Seguir editando"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onClose();
        }}
      />
    </div>,
    document.body,
  );
}
