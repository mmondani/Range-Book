import { ImageOff } from 'lucide-react';
import { usePhotoSrc } from '@/hooks/use-photos';
import { cx } from '@/lib/cx';
import type { PhotoDraft } from '@/lib/photos';
import styles from './photo.module.css';

export interface PhotoProps {
  photo: PhotoDraft;
  alt: string;
  /** El tamaño y el `aspect-ratio` los define el contenedor. */
  className?: string;
}

/** Foto guardada en Storage o pendiente de subir. Mientras carga, muestra un placeholder. */
export function Photo({ photo, alt, className }: PhotoProps) {
  const state = usePhotoSrc(photo);
  return (
    <div
      className={cx(styles.photo, className)}
      aria-busy={state.status === 'loading' || undefined}
    >
      {state.status === 'ready' && (
        <img src={state.src} alt={alt} className={styles.image} decoding="async" />
      )}
      {state.status === 'error' && (
        <span role="img" aria-label={`${alt}: no se pudo cargar`} className={styles.error}>
          <ImageOff aria-hidden="true" />
        </span>
      )}
    </div>
  );
}
