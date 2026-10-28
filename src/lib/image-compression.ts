/** Lado mayor de las fotos que se suben a Storage. */
export const MAX_PHOTO_SIDE = 2000;
export const JPEG_QUALITY = 0.8;

export interface Size {
  width: number;
  height: number;
}

/**
 * Tamaño final de una imagen para que su lado mayor no pase de `maxSide`, sin deformarla.
 * Las imágenes más chicas no se agrandan.
 */
export function fitWithin({ width, height }: Size, maxSide = MAX_PHOTO_SIDE): Size {
  if (!(width > 0 && height > 0)) throw new Error('La imagen no tiene dimensiones válidas');
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export interface CompressedImage extends Size {
  blob: Blob;
}

/**
 * Redimensiona la imagen (lado mayor de 2000 px) y la vuelve a codificar como JPEG al 80 %.
 * Al pasar por el canvas se descartan los metadatos EXIF, incluida la ubicación.
 */
export async function compressImage(
  file: Blob,
  { maxSide = MAX_PHOTO_SIDE, quality = JPEG_QUALITY } = {},
): Promise<CompressedImage> {
  // `from-image` respeta la orientación EXIF de las fotos del celular.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const size = fitWithin(bitmap, maxSide);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('El navegador no permite dibujar en un canvas');
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob) throw new Error('No se pudo codificar la imagen');
    return { blob, ...size };
  } finally {
    bitmap.close();
  }
}
