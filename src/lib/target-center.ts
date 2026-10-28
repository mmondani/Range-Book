import type { ImageSize, Pixel } from './calibration';
import { boxSum, grayscale, integral, type PixelImage } from './pixel-image';

/** Lado mayor (px) al que se reduce la foto para buscar el centro: alcanza y es rápido. */
export const CENTER_DETECTION_SIZE = 400;

/** Intensidad mínima del borde (operador de Sobel) para que un píxel vote. */
const EDGE_THRESHOLD = 80;
/** Radio de la ventana en la que se suman los votos del centro candidato. */
const PEAK_RADIUS = 3;
/** Distancia máxima (px + proporción de la distancia al borde) entre una recta y el centro. */
const LINE_TOLERANCE_PX = 1.5;
const LINE_TOLERANCE_SLOPE = 0.04;
const REFINE_ITERATIONS = 3;
/** Fracción mínima de los bordes que tiene que apuntar al centro para confiar en él. */
const MIN_SHARE = 0.2;
/** Con menos bordes que esto no hay un blanco que buscar. */
const MIN_EDGES = 50;

/** Escala (≤ 1) a la que conviene reducir la foto para buscar el centro. */
export function centerDetectionScale(size: ImageSize): number {
  return Math.min(1, CENTER_DETECTION_SIZE / Math.max(size.width, size.height));
}

/**
 * Busca el centro de un blanco de anillos concéntricos. Devuelve el punto en píxeles de `image`,
 * o `null` si no hay un centro claro.
 *
 * En el borde de un anillo (o del centro negro) el brillo cambia en dirección radial: la recta
 * que sigue esa dirección pasa por el centro. Cada píxel de borde vota a lo largo de su recta, el
 * punto con más votos es el candidato y se ajusta con las rectas que pasan cerca de él. No depende
 * del tamaño de los anillos y tolera agujeros, números impresos, el fondo detrás de la hoja y
 * anillos cortados por el borde de la foto.
 *
 * Es una propuesta: el usuario lo puede corregir tocando la foto.
 */
export function detectTargetCenter(image: PixelImage): Pixel | null {
  const { width, height } = image;
  // Un suavizado leve da direcciones de borde más precisas (y le quita peso al ruido).
  const gray = grayscale(image);
  const graySums = integral(gray, width, height);
  const at = (x: number, y: number) => {
    const { sum, area } = boxSum(graySums, width, height, x, y, 1);
    return sum / area;
  };

  // 1. Bordes: posición y dirección del cambio de brillo.
  const edgeX: number[] = [];
  const edgeY: number[] = [];
  const edgeDx: number[] = [];
  const edgeDy: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const gx =
        at(x + 1, y - 1) +
        2 * at(x + 1, y) +
        at(x + 1, y + 1) -
        at(x - 1, y - 1) -
        2 * at(x - 1, y) -
        at(x - 1, y + 1);
      const gy =
        at(x - 1, y + 1) +
        2 * at(x, y + 1) +
        at(x + 1, y + 1) -
        at(x - 1, y - 1) -
        2 * at(x, y - 1) -
        at(x + 1, y - 1);
      const magnitude = Math.hypot(gx, gy);
      if (magnitude < EDGE_THRESHOLD) continue;
      edgeX.push(x);
      edgeY.push(y);
      edgeDx.push(gx / magnitude);
      edgeDy.push(gy / magnitude);
    }
  }
  const edges = edgeX.length;
  if (edges < MIN_EDGES) return null;

  // 2. Votos: cada borde vota a lo largo de su recta, hacia los dos lados (anillo oscuro sobre
  //    papel o al revés).
  const votes = new Float32Array(width * height);
  for (let i = 0; i < edges; i++) {
    for (const sign of [1, -1]) {
      for (let t = 1; ; t++) {
        const px = Math.round(edgeX[i]! + sign * t * edgeDx[i]!);
        const py = Math.round(edgeY[i]! + sign * t * edgeDy[i]!);
        if (px < 0 || py < 0 || px >= width || py >= height) break;
        votes[py * width + px] = votes[py * width + px]! + 1;
      }
    }
  }

  // 3. Candidato: el punto cuya ventana junta más votos.
  const sums = integral(votes, width, height);
  let best = -1;
  let center: Pixel = { x: 0, y: 0 };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const { sum } = boxSum(sums, width, height, x, y, PEAK_RADIUS);
      if (sum > best) {
        best = sum;
        center = { x, y };
      }
    }
  }

  // 4. Ajuste: el punto más cercano (mínimos cuadrados) a las rectas que pasan cerca del
  //    candidato. La tolerancia crece con la distancia porque el error está en el ángulo.
  let inliers = 0;
  for (let iteration = 0; iteration < REFINE_ITERATIONS; iteration++) {
    let a11 = 0;
    let a12 = 0;
    let a22 = 0;
    let b1 = 0;
    let b2 = 0;
    inliers = 0;
    for (let i = 0; i < edges; i++) {
      const qx = edgeX[i]!;
      const qy = edgeY[i]!;
      // Normal de la recta del borde.
      const nx = -edgeDy[i]!;
      const ny = edgeDx[i]!;
      const offset = (center.x - qx) * nx + (center.y - qy) * ny;
      const distance = Math.hypot(center.x - qx, center.y - qy);
      if (Math.abs(offset) > LINE_TOLERANCE_PX + distance * LINE_TOLERANCE_SLOPE) continue;
      inliers++;
      const c = nx * qx + ny * qy;
      a11 += nx * nx;
      a12 += nx * ny;
      a22 += ny * ny;
      b1 += nx * c;
      b2 += ny * c;
    }
    const determinant = a11 * a22 - a12 * a12;
    if (determinant <= 1e-6) return null;
    center = {
      x: (a22 * b1 - a12 * b2) / determinant,
      y: (a11 * b2 - a12 * b1) / determinant,
    };
  }

  // Si pocos bordes apuntan al centro, no hay un blanco de anillos claro.
  return inliers >= edges * MIN_SHARE ? center : null;
}
