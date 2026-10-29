import { mmPerPixel, pixelEllipse, type Calibration, type Pixel } from './calibration';
import { boxSum, grayscale, integral, type PixelImage } from './pixel-image';
import type { TargetZone } from './target-zones';
import { MM_PER_INCH } from './units';

/**
 * Parámetros de la detección. Los tamaños son relativos al diámetro del agujero, así sirven para
 * cualquier calibre y resolución. La herramienta de `calibration/` los cambia para comparar.
 */
export interface DetectionTuning {
  /** Diferencia mínima de brillo (0–255) contra el entorno para considerar un píxel. */
  threshold: number;
  /** Radio de la ventana del entorno, en agujeros. */
  windowRatio: number;
  /** La erosión tiene un radio de 1/`erosionDivisor` de agujero. */
  erosionDivisor: number;
  /** Área de una mancha, en veces la de un agujero erosionado. */
  minAreaRatio: number;
  maxAreaRatio: number;
  /** Lado mayor del rectángulo de una mancha, en diámetros de agujero erosionado. */
  maxSideRatio: number;
  /** Fracción mínima del rectángulo que ocupa la mancha (descarta formas alargadas o ralas). */
  minFill: number;
}

export const DEFAULT_TUNING: Readonly<DetectionTuning> = {
  threshold: 45,
  windowRatio: 1.5,
  erosionDivisor: 6,
  minAreaRatio: 0.3,
  maxAreaRatio: 4,
  maxSideRatio: 2.5,
  minFill: 0.35,
};

export interface DetectionOptions {
  /** Diámetro esperado de un agujero, en píxeles de `image`. */
  holeDiameterPx: number;
  /** Solo se buscan impactos dentro de este círculo (la zona calibrada del blanco). */
  region?: { center: Pixel; radius: number };
  /** Tope de impactos: más que esto es ruido (papel arrugado, sombras). */
  maxImpacts?: number;
  /** Parámetros distintos de los de `DEFAULT_TUNING`. */
  tuning?: Partial<DetectionTuning>;
}

/** Calibre por defecto si no se reconoce el del arma (9 mm). */
export const DEFAULT_HOLE_MM = 9;
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
  const tuning = { ...DEFAULT_TUNING, ...options.tuning };
  const threshold = tuning.threshold;
  const region = options.region;
  const inRegion = (x: number, y: number) =>
    !region || Math.hypot(x - region.center.x, y - region.center.y) <= region.radius;

  // 1. Umbral adaptativo contra el promedio de una ventana de ~3 agujeros.
  const gray = grayscale(image);
  const graySums = integral(gray, width, height);
  const window = Math.max(3, Math.round(hole * tuning.windowRatio));
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inRegion(x, y)) continue;
      const { sum, area } = boxSum(graySums, width, height, x, y, window);
      if (Math.abs(gray[y * width + x]! - sum / area) > threshold) mask[y * width + x] = 1;
    }
  }

  // 2. Erosión con un cuadrado de radio ~⅙ de agujero.
  const erosion = Math.max(1, Math.floor(hole / tuning.erosionDivisor));
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
  const maxSide = tuning.maxSideRatio * 2 * core + 2;
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
      area >= expectedArea * tuning.minAreaRatio &&
      area <= expectedArea * tuning.maxAreaRatio &&
      Math.max(boxWidth, boxHeight) <= maxSide &&
      area / (boxWidth * boxHeight) >= tuning.minFill;
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
  // Con los anillos deformados, el círculo que contiene a la elipse del anillo exterior.
  const ring = outer > 0 ? pixelEllipse(calibration, outer / 2) : undefined;
  return {
    holeDiameterPx: (holeMm / mmPerPixel(calibration)) * scale,
    region: ring
      ? {
          center: { x: calibration.center.x * scale, y: calibration.center.y * scale },
          radius: Math.max(ring.rx, ring.ry) * REGION_MARGIN * scale,
        }
      : undefined,
  };
}

/**
 * Detecta los impactos en la foto calibrada, ya reducida a `pixels` (con `detectionScale`).
 * Devuelve los puntos en píxeles de la foto calibrada. Es lo que hace el análisis al tocar
 * "Detectar", y lo que evalúa la herramienta de `calibration/`.
 */
export function detectImpactsInPhoto(
  pixels: PixelImage,
  calibration: Calibration,
  zones: readonly TargetZone[],
  holeMm: number,
  options: Pick<DetectionOptions, 'maxImpacts' | 'tuning'> = {},
): Pixel[] {
  // La foto reducida se redondea: se usa la escala real de cada eje.
  const scaleX = pixels.width / calibration.width;
  const scaleY = pixels.height / calibration.height;
  const found = detectImpacts(pixels, {
    ...detectionOptions(calibration, zones, holeMm, scaleX),
    ...options,
  });
  // Del centro del píxel de la foto reducida al punto de la original.
  return found.map(({ x, y }) => ({ x: (x + 0.5) / scaleX, y: (y + 0.5) / scaleY }));
}
