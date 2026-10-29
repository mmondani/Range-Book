import { useEffect, useState } from 'react';
import type { PhotoDraft } from '@/lib/photos';
import type { DatasetFolder } from '../data/dataset-folder';

export type PhotoSource =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; photo: PhotoDraft & { blob: Blob } };

/** Lee de la carpeta la foto elegida, como una foto local para `TargetAnalyzer`. */
export function usePhotoSource(folder: DatasetFolder, file: string | undefined): PhotoSource {
  const [loaded, setLoaded] = useState<{ file: string; source: PhotoSource }>();

  useEffect(() => {
    if (!file) return;
    let active = true;
    folder.readFile(file).then(
      (blob) =>
        active &&
        setLoaded({
          file,
          source: blob
            ? { status: 'ready', photo: { status: 'pending', id: file, name: file, blob } }
            : { status: 'error' },
        }),
      () => active && setLoaded({ file, source: { status: 'error' } }),
    );
    return () => {
      active = false;
    };
  }, [folder, file]);

  return loaded && loaded.file === file ? loaded.source : { status: 'loading' };
}
