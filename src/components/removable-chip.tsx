import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './chip.module.css';

export interface RemovableChipProps {
  children: ReactNode;
  /** Texto del botón de quitar, por ejemplo "Quitar Mira Holosun". */
  removeLabel: string;
  onRemove: () => void;
  icon?: ReactNode;
  className?: string;
}

export function RemovableChip({
  children,
  removeLabel,
  onRemove,
  icon,
  className,
}: RemovableChipProps) {
  return (
    <span className={cx(styles.chip, styles.removable, className)}>
      {icon}
      {children}
      <button type="button" className={styles.remove} aria-label={removeLabel} onClick={onRemove}>
        <X className={styles.icon} aria-hidden="true" />
      </button>
    </span>
  );
}
