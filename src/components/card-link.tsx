import { Link, type LinkProps } from 'react-router';
import { cx } from '@/lib/cx';
import styles from './card.module.css';

export interface CardLinkProps extends LinkProps {
  padded?: boolean;
}

/** Tarjeta clickeable: es un link, con hover en el borde. */
export function CardLink({ padded = true, className, ...rest }: CardLinkProps) {
  return (
    <Link
      className={cx(styles.card, styles.interactive, padded && styles.padded, className)}
      {...rest}
    />
  );
}
