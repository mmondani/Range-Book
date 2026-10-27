import type { TextareaHTMLAttributes } from 'react';
import { cx } from '@/lib/cx';
import styles from './control.module.css';
import { useFieldContext } from './field-context';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ rows = 3, className, ...rest }: TextareaProps) {
  const field = useFieldContext();
  return (
    <textarea
      rows={rows}
      className={cx(styles.control, styles.textarea, className)}
      {...field?.control}
      {...rest}
    />
  );
}
