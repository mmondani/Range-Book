import { Camera, Images, Upload, X } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { usePhotoViewer } from '@/hooks/use-photo-viewer';
import { useToast } from '@/hooks/use-toast';
import { cx } from '@/lib/cx';
import { compressImage } from '@/lib/image-compression';
import { pendingPhoto, photoKey, type PhotoDraft } from '@/lib/photos';
import { Button } from './button';
import { useFieldContext } from './field-context';
import { PhotoButton } from './photo-button';
import { PhotoViewer } from './photo-viewer';
import styles from './photo-picker.module.css';

export interface PhotoPickerProps {
  value: PhotoDraft[];
  onChange: (photos: PhotoDraft[]) => void;
  /** Varias fotos (por defecto) o una sola: elegir otra la reemplaza. */
  multiple?: boolean;
  /** Marca la primera foto como portada. */
  cover?: boolean;
  className?: string;
}

// Algunos navegadores no informan el tipo de las HEIC: se intentan leer igual.
const isImage = (file: File) => file.type === '' || file.type.startsWith('image/');

/**
 * Cámara / Galería en mobile y zona para arrastrar en desktop. Las fotos se comprimen al
 * elegirlas y quedan pendientes: se suben a Storage al guardar el formulario (`uploadPhotos`).
 * Usar dentro de un `Field` con `kind="group"`.
 */
export function PhotoPicker({
  value,
  onChange,
  multiple = true,
  cover = false,
  className,
}: PhotoPickerProps) {
  const field = useFieldContext();
  const toast = useToast();
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const viewer = usePhotoViewer();

  async function addFiles(files: File[]) {
    if (files.length === 0 || processing) return;
    const images = files.filter(isImage);
    if (images.length < files.length) {
      toast.show({ message: 'Solo se pueden agregar imágenes.', tone: 'error' });
    }
    const selected = multiple ? images : images.slice(0, 1);
    if (selected.length === 0) return;

    setProcessing(true);
    const results = await Promise.allSettled(
      selected.map(async (file) => pendingPhoto((await compressImage(file)).blob, file.name)),
    );
    setProcessing(false);

    const added = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    const failed = results.length - added.length;
    if (failed > 0) {
      toast.show({
        message:
          failed === 1 ? 'No se pudo leer una foto.' : `No se pudieron leer ${failed} fotos.`,
        tone: 'error',
      });
    }
    if (added.length > 0) onChange(multiple ? [...value, ...added] : added);
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Permite volver a elegir el mismo archivo.
    event.target.value = '';
    void addFiles(files);
  }

  function handleDragOver(event: DragEvent) {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  }

  function handleDragLeave(event: DragEvent) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void addFiles(Array.from(event.dataTransfer.files));
  }

  const openGallery = () => galleryInput.current?.click();

  return (
    <div
      role="group"
      aria-labelledby={field?.labelId}
      aria-describedby={field?.control['aria-describedby']}
      aria-busy={processing || undefined}
      className={cx(styles.picker, dragging && styles.dragging, className)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={styles.actions}>
        <Button variant="ghost" loading={processing} onClick={() => cameraInput.current?.click()}>
          {!processing && <Camera aria-hidden="true" />}
          Cámara
        </Button>
        <Button variant="ghost" disabled={processing} onClick={openGallery}>
          <Images aria-hidden="true" />
          Galería
        </Button>
      </div>

      <ul className={cx(styles.grid, value.length > 0 && styles.hasPhotos)}>
        {value.map((photo, index) => {
          const isCover = cover && index === 0;
          return (
            <li key={photoKey(photo)} className={cx(styles.item, isCover && styles.cover)}>
              <PhotoButton
                photo={photo}
                alt={isCover ? 'Portada' : `Foto ${index + 1}`}
                label={`Ver ${isCover ? 'la portada' : `la foto ${index + 1}`} en pantalla completa`}
                className={styles.photo}
                onClick={() => viewer.open(index)}
              />
              {isCover && (
                <span className={styles.coverLabel} aria-hidden="true">
                  Portada
                </span>
              )}
              <button
                type="button"
                className={styles.remove}
                aria-label={`Quitar foto ${index + 1}`}
                disabled={processing}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <X aria-hidden="true" />
              </button>
            </li>
          );
        })}
        <li className={styles.dropItem}>
          <button
            type="button"
            className={styles.dropzone}
            disabled={processing}
            onClick={openGallery}
          >
            <Upload aria-hidden="true" />
            {processing ? 'Procesando…' : 'Arrastrá o elegí archivos'}
          </button>
        </li>
      </ul>

      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        data-testid="photo-camera-input"
        onChange={handleInput}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        data-testid="photo-gallery-input"
        onChange={handleInput}
      />

      {viewer.index !== null && (
        <PhotoViewer
          photos={value}
          start={viewer.index}
          label="Fotos elegidas"
          onClose={viewer.close}
        />
      )}
    </div>
  );
}
