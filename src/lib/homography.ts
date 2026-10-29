/**
 * Homografías del plano: matrices 3 × 3 que llevan un punto de un plano a otro con perspectiva
 * (en `calibration.ts`, del blanco en mm a la foto en píxeles). Los puntos van en coordenadas
 * homogéneas: `(x, y)` es `(x, y, 1)`.
 */

/** Matriz 3 × 3 por filas: `[a, b, c, d, e, f, g, h, i]`. */
export type Matrix3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export interface Point {
  x: number;
  y: number;
}

export const IDENTITY: Matrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function multiply(a: Matrix3, b: Matrix3): Matrix3 {
  const cell = (row: number, column: number) =>
    a[row * 3]! * b[column]! + a[row * 3 + 1]! * b[3 + column]! + a[row * 3 + 2]! * b[6 + column]!;
  return [
    cell(0, 0),
    cell(0, 1),
    cell(0, 2),
    cell(1, 0),
    cell(1, 1),
    cell(1, 2),
    cell(2, 0),
    cell(2, 1),
    cell(2, 2),
  ];
}

export function transpose(m: Matrix3): Matrix3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

export function invert(m: Matrix3): Matrix3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    A / det,
    -(b * i - c * h) / det,
    (b * f - c * e) / det,
    B / det,
    (a * i - c * g) / det,
    -(a * f - c * d) / det,
    C / det,
    -(a * h - b * g) / det,
    (a * e - b * d) / det,
  ];
}

/** Escala de los dos primeros ejes: `diag(k, k, 1)`. */
export const scaling = (k: number): Matrix3 => [k, 0, 0, 0, k, 0, 0, 0, 1];

/** Lleva un punto con la homografía (y lo vuelve a coordenadas cartesianas). */
export function project(m: Matrix3, { x, y }: Point): Point {
  const w = m[6] * x + m[7] * y + m[8];
  return { x: (m[0] * x + m[1] * y + m[2]) / w, y: (m[3] * x + m[4] * y + m[5]) / w };
}

/**
 * Cuánto se estira la homografía alrededor de `at`: la raíz del determinante de su derivada (el
 * factor de escala promedio entre las dos direcciones).
 */
export function localScale(m: Matrix3, at: Point): number {
  const w = m[6] * at.x + m[7] * at.y + m[8];
  const { x: u, y: v } = project(m, at);
  const j00 = (m[0] - u * m[6]) / w;
  const j01 = (m[1] - u * m[7]) / w;
  const j10 = (m[3] - v * m[6]) / w;
  const j11 = (m[4] - v * m[7]) / w;
  return Math.sqrt(Math.abs(j00 * j11 - j01 * j10));
}

/** Elipse en el plano de llegada: centro, radios y giro en grados (como `rotate` de SVG). */
export interface Ellipse {
  center: Point;
  rx: number;
  ry: number;
  angle: number;
}

/**
 * Cómo se ve con la homografía un círculo de radio `radius` centrado en `center`. Un círculo
 * proyectado es una cónica: si la homografía tiene perspectiva, su centro ya no es la imagen del
 * centro del círculo.
 */
export function projectCircle(m: Matrix3, center: Point, radius: number): Ellipse {
  const { x: cx, y: cy } = center;
  // El círculo como cónica: (x − cx)² + (y − cy)² − r² = 0.
  const circle: Matrix3 = [1, 0, -cx, 0, 1, -cy, -cx, -cy, cx * cx + cy * cy - radius * radius];
  const inverse = invert(m);
  const [a, b, d, , c, e, , , g] = multiply(multiply(transpose(inverse), circle), inverse);
  const det = a * c - b * b;
  const x0 = (b * e - c * d) / det;
  const y0 = (b * d - a * e) / det;
  const g0 = g + d * x0 + e * y0;
  const mean = (a + c) / 2;
  const diff = Math.hypot((a - c) / 2, b);
  const major = mean - diff;
  const minor = mean + diff;
  const angle =
    Math.abs(b) < 1e-12 ? (a <= c ? 0 : 90) : (Math.atan2(major - a, b) * 180) / Math.PI;
  return {
    center: { x: x0, y: y0 },
    rx: Math.sqrt(-g0 / major),
    ry: Math.sqrt(-g0 / minor),
    angle,
  };
}
