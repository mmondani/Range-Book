import type { ButtonHTMLAttributes } from 'react';
import { cx } from '@/lib/cx';
import styles from './button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

export interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleProps {
  loading?: boolean;
}

/** Clases de `Button`, para reusarlas en links con aspecto de botón. */
export function buttonClassName({
  variant = 'secondary',
  size = 'md',
  block = false,
}: ButtonStyleProps = {}) {
  return cx(
    styles.button,
    variant !== 'secondary' && styles[variant],
    size === 'lg' && styles.lg,
    block && styles.block,
  );
}

export function Button({
  variant,
  size,
  block,
  loading = false,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        buttonClassName({ variant, size, block }),
        loading && styles.loading,
        className,
      )}
      {...rest}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
}
