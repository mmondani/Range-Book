import { STATUS_LABELS, type DatasetPhoto } from '../lib/dataset';
import styles from './tool.module.css';

export interface PhotoListProps {
  photos: readonly DatasetPhoto[];
  /** Fotos del set cuyo archivo ya no está en la carpeta. */
  missing: readonly string[];
  selected: string | undefined;
  onSelect: (file: string) => void;
}

/** Fotos del set con su estado. */
export function PhotoList({ photos, missing, selected, onSelect }: PhotoListProps) {
  const done = photos.filter((photo) => photo.status === 'done').length;
  return (
    <nav aria-label="Fotos" className={styles.stack}>
      <p className={styles.muted} role="status">
        {photos.length} fotos · {done} listas
      </p>
      <ol className={styles.list}>
        {photos.map((photo) => {
          const gone = missing.includes(photo.file);
          return (
            <li key={photo.file}>
              <button
                type="button"
                className={styles.item}
                aria-current={photo.file === selected ? 'true' : undefined}
                onClick={() => onSelect(photo.file)}
              >
                <span>{photo.file}</span>{' '}
                <span className={styles.status} data-status={gone ? 'missing' : photo.status}>
                  {gone ? 'Falta el archivo' : STATUS_LABELS[photo.status]}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
