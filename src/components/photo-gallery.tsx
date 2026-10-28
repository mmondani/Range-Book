import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { cx } from '@/lib/cx';
import { photoKey, type PhotoDraft } from '@/lib/photos';
import { Photo } from './photo';
import styles from './photo-gallery.module.css';

export interface PhotoGalleryProps {
  photos: PhotoDraft[];
  /** Nombre del grupo para lectores de pantalla, por ejemplo "Fotos del polígono". */
  label: string;
  className?: string;
}

/** Imagen principal, contador "1 / 3" y miniaturas para cambiar de foto. */
export function PhotoGallery({ photos, label, className }: PhotoGalleryProps) {
  const [selected, setSelected] = useState(0);
  // Si se quitan fotos, no queda apuntando fuera de la lista.
  const current = Math.min(selected, photos.length - 1);
  const photo = photos[current];

  if (!photo) {
    return (
      <div role="group" aria-label={label} className={cx(styles.gallery, className)}>
        <div className={cx(styles.main, styles.empty)}>
          <ImageOff aria-hidden="true" />
          Sin fotos
        </div>
      </div>
    );
  }

  return (
    <div role="group" aria-label={label} className={cx(styles.gallery, className)}>
      <div className={styles.main}>
        <Photo
          photo={photo}
          alt={`Foto ${current + 1} de ${photos.length}`}
          className={styles.mainPhoto}
        />
        {photos.length > 1 && (
          <span className={cx('num', styles.counter)} aria-hidden="true">
            {current + 1} / {photos.length}
          </span>
        )}
      </div>

      {photos.length > 1 && (
        <ul className={styles.thumbs}>
          {photos.map((thumb, index) => (
            <li key={photoKey(thumb)}>
              <button
                type="button"
                className={cx(styles.thumb, index === current && styles.selected)}
                aria-label={`Ver foto ${index + 1}`}
                aria-pressed={index === current}
                onClick={() => setSelected(index)}
              >
                <Photo photo={thumb} alt="" className={styles.thumbPhoto} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
