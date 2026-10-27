import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './badge.module.css';

export interface BadgeProps {
  tone?: 'success' | 'warning' | 'accent' | 'neutral';
  icon?: ReactNode;
  /** Siempre con texto: el color nunca es el único indicador. */
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', icon, children, className }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
