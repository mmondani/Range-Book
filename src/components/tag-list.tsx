import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './tag-list.module.css';

export interface TagListProps {
  'aria-label'?: string;
  children: ReactNode;
  className?: string;
}

/** Lista de `Tag` en varias líneas. Cada hijo va en un `<li>`. */
export function TagList({ 'aria-label': ariaLabel, children, className }: TagListProps) {
  return (
    <ul aria-label={ariaLabel} className={cx(styles.list, className)}>
      {children}
    </ul>
  );
}
