/**
 * Lectura de los píxeles de una foto y utilidades comunes a la detección de impactos y del
 * centro del blanco.
 */

/** Imagen RGBA, como `ImageData` (para poder testearla sin canvas). */
export interface PixelImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** Imagen en escala de grises (0–255). */
export function grayscale({ width, height, data }: PixelImage): Float32Array {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
  }
  return gray;
}

/** Imagen integral: la suma de cualquier rectángulo en O(1). */
export function integral(values: ArrayLike<number>, width: number, height: number): Float64Array {
  const sums = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += values[y * width + x]!;
      sums[(y + 1) * (width + 1) + x + 1] = sums[y * (width + 1) + x + 1]! + row;
    }
  }
  return sums;
}

/** Suma del cuadrado de radio `r` alrededor de (x, y), recortado a la imagen, y su área. */
export function boxSum(
  sums: Float64Array,
  width: number,
  height: number,
  x: number,
  y: number,
  r: number,
): { sum: number; area: number } {
  const x0 = Math.max(0, x - r);
  const y0 = Math.max(0, y - r);
  const x1 = Math.min(width, x + r + 1);
  const y1 = Math.min(height, y + r + 1);
  const w = width + 1;
  return {
    sum: sums[y1 * w + x1]! - sums[y0 * w + x1]! - sums[y1 * w + x0]! + sums[y0 * w + x0]!,
    area: (x1 - x0) * (y1 - y0),
  };
}

/**
 * Lee los píxeles de una foto, reducida por `scale` (≤ 1) para que la detección sea rápida.
 * Necesita canvas: no se usa en los tests unitarios.
 */
export async function readImagePixels(blob: Blob, scale: number): Promise<PixelImage> {
  const bitmap = await createImageBitmap(blob);
  try {
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('El navegador no permite dibujar en un canvas');
    // Al reducir mucho, el suavizado de calidad conserva las líneas finas de los anillos.
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  } finally {
    bitmap.close();
  }
}
