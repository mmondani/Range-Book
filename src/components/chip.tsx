import { ChevronDown, Plus } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './chip.module.css';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * `filter` muestra un caret (y `selected` lo resalta, si el filtro está aplicado); `selectable`
   * usa `selected`; `add` tiene borde punteado.
   */
  variant?: 'filter' | 'selectable' | 'add';
  selected?: boolean;
  icon?: ReactNode;
}

export function Chip({
  variant = 'selectable',
  selected = false,
  icon,
  type = 'button',
  className,
  children,
  ...rest
}: ChipProps) {
  const isSelectable = variant === 'selectable';
  return (
    <button
      type={type}
      aria-pressed={isSelectable && rest.role === undefined ? selected : undefined}
      className={cx(
        styles.chip,
        (isSelectable || variant === 'filter') && selected && styles.on,
        variant === 'add' && styles.add,
        className,
      )}
      {...rest}
    >
      {variant === 'add' ? <Plus className={styles.icon} aria-hidden="true" /> : icon}
      {children}
      {variant === 'filter' && <ChevronDown className={styles.icon} aria-hidden="true" />}
    </button>
  );
}
