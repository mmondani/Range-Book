import { Link, type LinkProps } from 'react-router';
import { cx } from '@/lib/cx';
import { buttonClassName, type ButtonStyleProps } from './button';

export type LinkButtonProps = LinkProps & ButtonStyleProps;

/** Link de navegación con el aspecto de `Button`. */
export function LinkButton({ variant, size, block, className, ...rest }: LinkButtonProps) {
  return <Link className={cx(buttonClassName({ variant, size, block }), className)} {...rest} />;
}
