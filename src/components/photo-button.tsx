import { cx } from '@/lib/cx';
import type { PhotoDraft } from '@/lib/photos';
import { Photo } from './photo';
import styles from './photo-button.module.css';

export interface PhotoButtonProps {
  photo: PhotoDraft;
  /** Texto alternativo de la foto, como en `Photo` ("Foto 2 de 3"). */
  alt: string;
  /** Nombre del botón, por ejemplo "Ver la foto 2 de 3 en pantalla completa". */
  label: string;
  onClick: () => void;
  /** El tamaño y el `aspect-ratio` los define el contenedor, como en `Photo`. */
  className?: string;
}

/** Foto que se toca para verla a pantalla completa (`PhotoViewer`). */
export function PhotoButton({ photo, alt, label, onClick, className }: PhotoButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cx(styles.button, className)}
      onClick={onClick}
    >
      <Photo photo={photo} alt={alt} className={styles.photo} />
    </button>
  );
}
