import { Archive, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';
import { BottomSheet } from './bottom-sheet';
import { Button } from './button';
import styles from './inventory-sheet.module.css';

export interface InventorySheetProps {
  title: string;
  eyebrow?: string;
  submitLabel: string;
  children: ReactNode;
  dirty: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  /** Solo al editar: archivar el elemento (por ejemplo, "Archivar munición"). */
  archive?: { label: string; onArchive: () => void; loading: boolean };
  /** Solo al editar algo que se elimina en lugar de archivarse (por ejemplo, "Eliminar ronda"). */
  remove?: { label: string; onRemove: () => void };
  /** Cambia en cada intento de guardar con errores: el foco va al primer campo inválido. */
  errorAttempt: number;
}

/** Alta y edición de un elemento (del inventario o una ronda) en un sheet (diálogo en desktop). */
export function InventorySheet({
  title,
  eyebrow,
  submitLabel,
  children,
  dirty,
  saving,
  onClose,
  onSubmit,
  archive,
  remove,
  errorAttempt,
}: InventorySheetProps) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (errorAttempt > 0)
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errorAttempt]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <BottomSheet
      open
      title={title}
      eyebrow={eyebrow}
      dirty={dirty && !saving}
      onClose={onClose}
      footer={(requestClose) => (
        <>
          <Button variant="ghost" onClick={requestClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form={formId} loading={saving}>
            {submitLabel}
          </Button>
        </>
      )}
    >
      <form id={formId} ref={formRef} noValidate className={styles.form} onSubmit={handleSubmit}>
        {children}
        {archive && (
          <Button
            variant="ghost"
            className={styles.archive}
            loading={archive.loading}
            disabled={saving}
            onClick={archive.onArchive}
          >
            <Archive aria-hidden="true" size={18} />
            {archive.label}
          </Button>
        )}
        {remove && (
          <Button
            variant="danger"
            className={styles.archive}
            disabled={saving}
            onClick={remove.onRemove}
          >
            <Trash2 aria-hidden="true" size={18} />
            {remove.label}
          </Button>
        )}
      </form>
    </BottomSheet>
  );
}
