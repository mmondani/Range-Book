import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './tag.module.css';

export interface TagProps {
  children: ReactNode;
  /** Atenuado, por ejemplo para una modificación archivada. */
  muted?: boolean;
  className?: string;
}

/** Etiqueta chica, no interactiva (modificaciones de una configuración, calibre). */
export function Tag({ children, muted = false, className }: TagProps) {
  return <span className={cx(styles.tag, muted && styles.muted, className)}>{children}</span>;
}
