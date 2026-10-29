import { APP_NAME } from '@/lib/app-info';
import { cx } from '@/lib/cx';
import styles from './logo.module.css';

export interface LogoProps {
  size?: number;
  withName?: boolean;
  className?: string;
}

/** Logo provisorio: diana con cruz dentro de un cuadrado redondeado naranja. */
export function Logo({ size = 36, withName = false, className }: LogoProps) {
  return (
    <span className={cx(styles.logo, className)}>
      <span className={styles.mark} style={{ width: size, height: size }} aria-hidden="true">
        <svg viewBox="0 0 24 24" width={size * 0.66} height={size * 0.66}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 1v5M12 18v5M1 12h5M18 12h5" />
        </svg>
      </span>
      {withName ? (
        <span className={cx('display', styles.name)}>{APP_NAME}</span>
      ) : (
        <span className="visually-hidden">{APP_NAME}</span>
      )}
    </span>
  );
}
