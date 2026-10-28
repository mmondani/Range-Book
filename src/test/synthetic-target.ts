import type { Pixel } from '@/lib/calibration';
import type { PixelImage } from '@/lib/pixel-image';

export const PAPER = 233;
export const BLACK = 24;

/**
 * Blanco sintético: papel, centro negro y anillos finos, como una foto tomada de frente. Por
 * defecto, cuadrado de 240 px con el centro en el medio.
 */
export function syntheticTarget({
  width = 240,
  height = width,
  center = { x: width / 2, y: height / 2 },
}: { width?: number; height?: number; center?: Pixel } = {}) {
  const gray = new Float32Array(width * height).fill(PAPER);
  // Cada píxel se pinta según la fracción de sus 4 × 4 submuestras que cubre la figura, como
  // los bordes suavizados de una foto.
  const SAMPLES = 4;
  const paint = (test: (x: number, y: number) => boolean, value: number) => {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let covered = 0;
        for (let sy = 0; sy < SAMPLES; sy++) {
          for (let sx = 0; sx < SAMPLES; sx++) {
            if (test(x + (sx + 0.5) / SAMPLES - 0.5, y + (sy + 0.5) / SAMPLES - 0.5)) covered++;
          }
        }
        if (covered === 0) continue;
        const share = covered / SAMPLES ** 2;
        gray[y * width + x] = gray[y * width + x]! * (1 - share) + value * share;
      }
    }
  };
  const radius = (x: number, y: number) => Math.hypot(x - center.x, y - center.y);
  const target = {
    center,
    /** Círculo negro de radio `r`. */
    blackDisk(r: number) {
      paint((x, y) => radius(x, y) <= r, BLACK);
      return target;
    },
    /** Línea de anillo de 1 px. */
    ringLine(r: number) {
      paint((x, y) => Math.abs(radius(x, y) - r) <= 0.5, BLACK);
      return target;
    },
    /** Línea recta fina (un número impreso, un pliegue). */
    line(y0: number, x0: number, x1: number) {
      paint((x, y) => Math.round(y) === y0 && Math.round(x) >= x0 && Math.round(x) <= x1, BLACK);
      return target;
    },
    /** Rectángulo oscuro alrededor del papel (lo que se ve detrás de la hoja). */
    background(margin: number, value = 90) {
      paint(
        (x, y) =>
          x < margin - 0.5 ||
          y < margin - 0.5 ||
          x >= width - margin - 0.5 ||
          y >= height - margin - 0.5,
        value,
      );
      return target;
    },
    hole({ x, y }: Pixel, value: number, r = 4) {
      paint((px, py) => Math.hypot(px - x, py - y) <= r, value);
      return target;
    },
    /** Ruido determinístico de ±`amplitude` (textura del papel, compresión de la foto). */
    noise(amplitude: number) {
      let seed = 1;
      for (let i = 0; i < gray.length; i++) {
        seed = (seed * 16807) % 2147483647;
        gray[i] = gray[i]! + ((seed / 2147483647) * 2 - 1) * amplitude;
      }
      return target;
    },
    image(): PixelImage {
      const data = new Uint8ClampedArray(width * height * 4);
      gray.forEach((value, i) => {
        data.set([value, value, value, 255], i * 4);
      });
      return { width, height, data };
    },
  };
  return target;
}
