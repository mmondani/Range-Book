import type { HTMLAttributes } from 'react';
import { cx } from '@/lib/cx';
import styles from './card.module.css';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'li';
  padded?: boolean;
}

export function Card({ as: Tag = 'div', padded = true, className, ...rest }: CardProps) {
  return <Tag className={cx(styles.card, padded && styles.padded, className)} {...rest} />;
}
