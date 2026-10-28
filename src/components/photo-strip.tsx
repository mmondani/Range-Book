import { useState, type ReactNode, type UIEvent } from 'react';
import { cx } from '@/lib/cx';
import { photoKey, type PhotoDraft } from '@/lib/photos';
import { Photo } from './photo';
import styles from './photo-strip.module.css';

export interface PhotoStripProps {
  photos: PhotoDraft[];
  /** Nombre del grupo para lectores de pantalla, por ejemplo "Fotos del polígono". */
  label: string;
  /** Botones que van sobre la foto (volver, editar…). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Encabezado de M03: fotos a todo el ancho que se deslizan de a una, con el contador "1 / 3 fotos"
 * y botones encima. Sin fotos, solo quedan los botones.
 */
export function PhotoStrip({ photos, label, actions, className }: PhotoStripProps) {
  const [current, setCurrent] = useState(0);

  function handleScroll(event: UIEvent<HTMLUListElement>) {
    const { scrollLeft, clientWidth } = event.currentTarget;
    if (clientWidth > 0) setCurrent(Math.round(scrollLeft / clientWidth));
  }

  return (
    <div className={cx(styles.strip, photos.length === 0 && styles.empty, className)}>
      {photos.length > 0 && (
        <ul
          aria-label={label}
          className={styles.photos}
          onScroll={handleScroll}
          // Se puede desplazar con el teclado.
          tabIndex={photos.length > 1 ? 0 : undefined}
        >
          {photos.map((photo, index) => (
            <li key={photoKey(photo)} className={styles.slide}>
              <Photo
                photo={photo}
                alt={`Foto ${index + 1} de ${photos.length}`}
                className={styles.photo}
              />
            </li>
          ))}
        </ul>
      )}
      {actions && <div className={styles.actions}>{actions}</div>}
      {photos.length > 1 && (
        <span className={cx('num', styles.counter)} aria-hidden="true">
          {Math.min(current, photos.length - 1) + 1} / {photos.length} fotos
        </span>
      )}
    </div>
  );
}
