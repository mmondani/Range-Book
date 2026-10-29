import type { PhotoRepository } from '@/data/photo-repository';
import {
  measureImage,
  pickFolder,
  rememberedFolder,
  supportsFolders,
  type DatasetFolder,
} from './data/dataset-folder';
import { detectInPhoto } from './lib/evaluation-runner';
import type { MeasureImage } from './lib/folder-sync';

export interface RememberedFolder {
  name: string;
  reopen: () => Promise<DatasetFolder | null>;
}

/** Lo que la herramienta usa del navegador. Los tests pasan dobles. */
export interface ToolServices {
  supportsFolders: () => boolean;
  pickFolder: () => Promise<DatasetFolder | null>;
  rememberedFolder: () => Promise<RememberedFolder | null>;
  measureImage: MeasureImage;
  detectInPhoto: typeof detectInPhoto;
}

export const browserServices: ToolServices = {
  supportsFolders,
  pickFolder,
  rememberedFolder,
  measureImage,
  detectInPhoto,
};

/**
 * `TargetAnalyzer` muestra las fotos con un `PhotoProvider`. En la herramienta todas son locales
 * (`pending`), así que el repositorio de Storage nunca se usa.
 */
export const localPhotoRepository: PhotoRepository = {
  url: () => Promise.reject(new Error('Sin Storage')),
  blob: () => Promise.reject(new Error('Sin Storage')),
  upload: () => Promise.reject(new Error('Sin Storage')),
  remove: () => Promise.resolve(),
  syncPending: () => Promise.resolve(),
};
