import type { ReactNode } from 'react';
import type { LinkProps } from 'react-router';
import { cx } from '@/lib/cx';
import styles from './fab.module.css';
import { LinkButton } from './link-button';

export interface FabProps extends LinkProps {
  icon: ReactNode;
  children: ReactNode;
}

/** Botón flotante extendido (ícono + texto), sobre la barra inferior. Solo en mobile. */
export function Fab({ icon, children, className, ...rest }: FabProps) {
  return (
    <LinkButton variant="primary" className={cx(styles.fab, className)} {...rest}>
      {icon}
      {children}
    </LinkButton>
  );
}
