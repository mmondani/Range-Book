import type { HTMLAttributes } from 'react';
import { cx } from '@/lib/cx';
import styles from './chip.module.css';

/** Contenedor de chips: se acomodan en varias líneas, sin scroll horizontal. */
export function ChipGroup({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx(styles.group, className)} {...rest} />;
}
