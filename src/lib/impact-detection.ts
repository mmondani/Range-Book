import { mmPerPixel, mmToPixelLength, type Calibration, type Pixel } from './calibration';
import type { TargetZone } from './target-zones';
import { MM_PER_INCH } from './units';

/** Imagen RGBA, como `ImageData` (para poder testearla sin canvas). */
export interface PixelImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface DetectionOptions {
  /** Diámetro esperado de un agujero, en píxeles de `image`. */
  holeDiameterPx: number;
  /** Solo se buscan impactos dentro de este círculo (la zona calibrada del blanco). */
  region?: { center: Pixel; radius: number };
  /** Diferencia mínima de brillo (0–255) contra el entorno para considerar un píxel. */
  threshold?: number;
  /** Tope de impactos: más que esto es ruido (papel arrugado, sombras). */
  maxImpacts?: number;
}

/** Calibre por defecto si no se reconoce el del arma (9 mm). */
export const DEFAULT_HOLE_MM = 9;
const DEFAULT_THRESHOLD = 45;
const DEFAULT_MAX_IMPACTS = 200;

/**
 * Diámetro del agujero a partir del calibre del arma: `9×19 mm` → 9, `.22 LR` → 5,6,
 * `.380 ACP` → 9,7, `5.56×45` → 5,56, `45 ACP` → 11,4. Si no se reconoce, 9 mm.
 */
export function holeDiameterMm(caliber: string): number {
  const match = /(\d*[.,]?\d+)/.exec(caliber);
  if (!match) return DEFAULT_HOLE_MM;
  const value = Number(match[1]!.replace(',', '.'));
  if (!(value > 0)) return DEFAULT_HOLE_MM;
  // `.22`, `.380`: pulgadas.
  if (value < 1) return value * MM_PER_INCH;
  // `9`, `5.56`, `7,62`: mm.
  if (value <= 20) return value;
  // `22`, `45`, `308`: centésimas o milésimas de pulgada.
  return (value / (value >= 100 ? 1000 : 100)) * MM_PER_INCH;
}

/** Imagen en escala de grises (0–255). */
function grayscale({ width, height, data }: PixelImage): Float32Array {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
  }
  return gray;
}

/** Imagen integral: la suma de cualquier rectángulo en O(1). */
function integral(values: ArrayLike<number>, width: number, height: number): Float64Array {
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
function boxSum(
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
 * Detecta los agujeros de bala en la foto de un blanco. Devuelve el centro de cada uno, en
 * píxeles de `image`, ordenados de arriba hacia abajo.
 *
 * 1. Umbral adaptativo: se marcan los píxeles que se apartan del brillo de su entorno, en los
 *    dos sentidos (agujero oscuro sobre el papel o claro sobre el centro negro).
 * 2. Erosión: se borran las líneas finas (anillos impresos, números), más angostas que un
 *    tercio de agujero.
 * 3. Componentes conexas: se quedan las de tamaño y forma parecidos a un agujero. El borde del
 *    centro negro y las manchas grandes quedan afuera por tamaño.
 *
 * Es una propuesta: el usuario siempre puede agregar y quitar impactos a mano.
 */
export function detectImpacts(image: PixelImage, options: DetectionOptions): Pixel[] {
  const { width, height } = image;
  const hole = Math.max(2, options.holeDiameterPx);
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const region = options.region;
  const inRegion = (x: number, y: number) =>
    !region || Math.hypot(x - region.center.x, y - region.center.y) <= region.radius;

  // 1. Umbral adaptativo contra el promedio de una ventana de ~3 agujeros.
  const gray = grayscale(image);
  const graySums = integral(gray, width, height);
  const window = Math.max(3, Math.round(hole * 1.5));
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inRegion(x, y)) continue;
      const { sum, area } = boxSum(graySums, width, height, x, y, window);
      if (Math.abs(gray[y * width + x]! - sum / area) > threshold) mask[y * width + x] = 1;
    }
  }

  // 2. Erosión con un cuadrado de radio ~⅙ de agujero.
  const erosion = Math.max(1, Math.floor(hole / 6));
  const maskSums = integral(mask, width, height);
  const eroded = new Uint8Array(width * height);
  const full = (2 * erosion + 1) ** 2;
  for (let y = erosion; y < height - erosion; y++) {
    for (let x = erosion; x < width - erosion; x++) {
      if (mask[y * width + x] && boxSum(maskSums, width, height, x, y, erosion).sum === full) {
        eroded[y * width + x] = 1;
      }
    }
  }

  // 3. Componentes conexas (4 vecinos) con tamaño y forma de agujero.
  // Lo que queda de un agujero después de erosionarlo (la esquina del cuadrado llega a r·√2).
  const core = Math.max(1, hole / 2 - erosion * Math.SQRT2);
  const expectedArea = Math.PI * core * core;
  const maxSide = 2.5 * 2 * core + 2;
  const found: Pixel[] = [];
  const stack = new Int32Array(width * height);
  for (let start = 0; start < eroded.length; start++) {
    if (!eroded[start]) continue;
    eroded[start] = 0;
    let top = 0;
    stack[top++] = start;
    let area = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    while (top > 0) {
      const index = stack[--top]!;
      const x = index % width;
      const y = (index - x) / width;
      area++;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (const next of [index - 1, index + 1, index - width, index + width]) {
        const nx = next % width;
        if (next < 0 || next >= eroded.length || !eroded[next] || Math.abs(nx - x) > 1) continue;
        eroded[next] = 0;
        stack[top++] = next;
      }
    }
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    const holeLike =
      area >= expectedArea * 0.3 &&
      area <= expectedArea * 4 &&
      Math.max(boxWidth, boxHeight) <= maxSide &&
      area / (boxWidth * boxHeight) >= 0.35;
    if (holeLike) found.push({ x: sumX / area, y: sumY / area });
  }

  const max = options.maxImpacts ?? DEFAULT_MAX_IMPACTS;
  return found.sort((a, b) => a.y - b.y || a.x - b.x).slice(0, max);
}

/** Tamaño al que se reduce un agujero para detectarlo: alcanza y hace la búsqueda rápida. */
export const DETECTION_HOLE_PX = 10;

/** Margen alrededor del anillo exterior en el que también se buscan impactos. */
const REGION_MARGIN = 1.05;

/** Escala (≤ 1) a la que conviene reducir la foto para que un agujero mida ~10 px. */
export function detectionScale(calibration: Calibration, holeMm: number): number {
  const holePx = holeMm / mmPerPixel(calibration);
  return Math.min(1, DETECTION_HOLE_PX / holePx);
}

/**
 * Opciones de la detección sobre la foto reducida por `scale`: tamaño del agujero y, en los
 * blancos con anillos, la zona calibrada (el anillo exterior y un margen).
 */
export function detectionOptions(
  calibration: Calibration,
  zones: readonly TargetZone[],
  holeMm: number,
  scale: number,
): DetectionOptions {
  const outer = zones.reduce((max, zone) => Math.max(max, zone.diameterMm), 0);
  return {
    holeDiameterPx: (holeMm / mmPerPixel(calibration)) * scale,
    region:
      outer > 0
        ? {
            center: { x: calibration.center.x * scale, y: calibration.center.y * scale },
            radius: mmToPixelLength(calibration, outer / 2) * REGION_MARGIN * scale,
          }
        : undefined,
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
    context.drawImage(bitmap, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  } finally {
    bitmap.close();
  }
}
