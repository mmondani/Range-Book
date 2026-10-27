import type { InputHTMLAttributes } from 'react';
import { cx } from '@/lib/cx';
import styles from './control.module.css';
import { useFieldContext } from './field-context';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Unidad que se muestra dentro del campo, a la derecha (por ejemplo "m"). */
  suffix?: string;
}

export function Input({ suffix, className, ...rest }: InputProps) {
  const field = useFieldContext();
  const input = <input className={cx(styles.control, className)} {...field?.control} {...rest} />;
  if (!suffix) return input;
  return (
    <div className={styles.withSuffix}>
      {input}
      <span className={styles.suffix} aria-hidden="true">
        {suffix}
      </span>
    </div>
  );
}
