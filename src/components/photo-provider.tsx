import type { ReactNode } from 'react';
import type { PhotoRepository } from '@/data/photo-repository';
import { PhotoContext } from '@/hooks/use-photos';

export interface PhotoProviderProps {
  repository: PhotoRepository;
  children: ReactNode;
}

/** Acceso a las fotos de Storage para `Photo`, `PhotoPicker` y `PhotoGallery`. */
export function PhotoProvider({ repository, children }: PhotoProviderProps) {
  return <PhotoContext.Provider value={repository}>{children}</PhotoContext.Provider>;
}
