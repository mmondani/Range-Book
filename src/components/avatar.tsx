import { useState, type CSSProperties } from 'react';
import { cx } from '@/lib/cx';
import { initials } from '@/lib/format';
import styles from './avatar.module.css';

export interface AvatarProps {
  name: string;
  photoURL?: string | null;
  /** Diámetro en px. */
  size?: number;
  className?: string;
}

/** Foto de Google o, si no hay (o no carga), las iniciales sobre el acento. Es decorativo. */
export function Avatar({ name, photoURL, size = 36, className }: AvatarProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const style = { '--avatar-size': `${size}px` } as CSSProperties;

  if (photoURL && failed !== photoURL) {
    return (
      <img
        className={cx(styles.avatar, className)}
        style={style}
        src={photoURL}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(photoURL)}
      />
    );
  }
  return (
    <span className={cx('display', styles.avatar, className)} style={style} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
