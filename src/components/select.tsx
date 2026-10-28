import type { SelectHTMLAttributes } from 'react';
import { cx } from '@/lib/cx';
import styles from './control.module.css';
import { useFieldContext } from './field-context';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, ...rest }: SelectProps) {
  const field = useFieldContext();
  return (
    <select
      className={cx(styles.control, styles.select, className)}
      {...field?.control}
      {...rest}
    />
  );
}
