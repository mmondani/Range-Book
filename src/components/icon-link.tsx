import { Link, type LinkProps } from 'react-router';
import { cx } from '@/lib/cx';
import styles from './icon-button.module.css';

export interface IconLinkProps extends LinkProps {
  /** Obligatorio: el link solo tiene ícono. */
  'aria-label': string;
  onPhoto?: boolean;
}

/** Link de navegación con el aspecto de `IconButton`. */
export function IconLink({ onPhoto = false, className, ...rest }: IconLinkProps) {
  return <Link className={cx(styles.iconButton, onPhoto && styles.onPhoto, className)} {...rest} />;
}
