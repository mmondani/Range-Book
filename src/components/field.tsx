import { CircleAlert } from 'lucide-react';
import { useId, useMemo, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { FieldContext, type FieldContextValue } from './field-context';
import styles from './field.module.css';

export interface FieldProps {
  label: string;
  children: ReactNode;
  required?: boolean;
  help?: ReactNode;
  error?: string;
  /**
   * `group` para controles compuestos (`Stepper`, `SegmentedControl`, grupos de chips):
   * la etiqueta no es un `<label>` y el control la referencia con `aria-labelledby`.
   */
  kind?: 'control' | 'group';
  className?: string;
}

export function Field({
  label,
  children,
  required = false,
  help,
  error,
  kind = 'control',
  className,
}: FieldProps) {
  const id = useId();
  const controlId = `${id}-control`;
  const labelId = `${id}-label`;
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  const context = useMemo<FieldContextValue>(
    () => ({
      labelId,
      control: {
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
      },
    }),
    [labelId, controlId, describedBy, error, required],
  );

  const labelContent = (
    <>
      {label}
      {required && (
        <span className={styles.required} aria-hidden="true">
          {' *'}
        </span>
      )}
    </>
  );

  return (
    <div className={cx(styles.field, className)}>
      {kind === 'control' ? (
        <label id={labelId} htmlFor={controlId} className={styles.label}>
          {labelContent}
        </label>
      ) : (
        <span id={labelId} className={styles.label}>
          {labelContent}
        </span>
      )}
      <FieldContext.Provider value={context}>{children}</FieldContext.Provider>
      {help && (
        <span id={helpId} className={styles.help}>
          {help}
        </span>
      )}
      {error && (
        <span id={errorId} className={styles.error} role="alert">
          <CircleAlert aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}
