import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './empty-state.module.css';

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  text?: ReactNode;
  action?: ReactNode;
  /** Nivel del título, para no saltear headings. */
  headingLevel?: 2 | 3;
  className?: string;
}

/** Listas vacías y gráficos sin datos. */
export function EmptyState({
  icon,
  title,
  text,
  action,
  headingLevel = 2,
  className,
}: EmptyStateProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className={cx(styles.empty, className)}>
      <div className={styles.icon} aria-hidden="true">
        {icon}
      </div>
      <Heading className={cx('display', styles.title)}>{title}</Heading>
      {text && <p className={styles.text}>{text}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
