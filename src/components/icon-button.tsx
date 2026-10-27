import type { ButtonHTMLAttributes } from 'react';
import { cx } from '@/lib/cx';
import styles from './icon-button.module.css';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Obligatorio: el botón solo tiene ícono. */
  'aria-label': string;
  onPhoto?: boolean;
}

export function IconButton({
  onPhoto = false,
  type = 'button',
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.iconButton, onPhoto && styles.onPhoto, className)}
      {...rest}
    />
  );
}
