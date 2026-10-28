import type { InputHTMLAttributes } from 'react';
import { cx } from '@/lib/cx';
import styles from './control.module.css';
import { useFieldContext } from './field-context';

/** Fecha nativa (`type="date"`); el valor es `AAAA-MM-DD`. */
export type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function DateInput({ className, ...rest }: DateInputProps) {
  const field = useFieldContext();
  return (
    <input
      type="date"
      className={cx(styles.control, 'num', className)}
      {...field?.control}
      {...rest}
    />
  );
}
