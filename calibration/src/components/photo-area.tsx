import { TargetAnalyzer } from '@/components/target-analyzer';
import { cx } from '@/lib/cx';
import type { PhotoSource } from '../hooks/use-photo-source';
import type { DatasetPhoto, DatasetTarget, PhotoChanges } from '../lib/dataset';
import type { ToolServices } from '../services';
import { LabelingView } from './labeling-view';
import styles from './tool.module.css';

export interface PhotoAreaProps {
  photo: DatasetPhoto;
  target: DatasetTarget | undefined;
  source: PhotoSource;
  onChange: (changes: PhotoChanges) => void;
  services: ToolServices;
}

/**
 * La foto elegida: con el blanco elegido, el marcado; sin él, la foto sola (con lo que ya tenga
 * marcado) y el aviso de que falta el blanco para calibrarla.
 */
export function PhotoArea({ photo, target, source, onChange, services }: PhotoAreaProps) {
  if (source.status !== 'ready') {
    return (
      <p className={cx(styles.muted, styles.areaPhoto)}>
        {source.status === 'error' ? 'No se pudo leer la foto de la carpeta.' : 'Cargando la foto…'}
      </p>
    );
  }
  if (!target) {
    return (
      <section aria-label="Foto" className={cx(styles.stack, styles.areaPhoto)}>
        <p className={styles.warning}>
          Elegí el blanco de la foto (o pegá uno copiado de la app) para calibrarla y marcarla.
        </p>
        <TargetAnalyzer
          photo={source.photo}
          alt={`Foto ${photo.file}`}
          size={{ width: photo.width, height: photo.height }}
          onSize={() => {}}
          onPoint={() => {}}
          impacts={photo.impacts}
        />
      </section>
    );
  }
  const blob = source.photo.blob;
  return (
    <LabelingView
      // Al cambiar de foto o de blanco, el marcado arranca de nuevo.
      key={`${photo.file}|${target.id}`}
      photo={photo}
      target={target}
      source={source.photo}
      onChange={onChange}
      onDetect={() =>
        photo.calibration
          ? services.detectInPhoto(blob, { ...photo, calibration: photo.calibration }, target)
          : Promise.reject(new Error('Sin calibración'))
      }
    />
  );
}
