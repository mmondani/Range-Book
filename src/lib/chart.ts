import { formatDayMonth } from './format';

/**
 * Escalas de los gráficos de Rendimiento (`LineChart`, `BarChart`): marcas "redondas" del eje y y
 * qué puntos llevan etiqueta en el eje x.
 */

const STEPS = [1, 2, 2.5, 5, 10];

/** Paso redondo (1, 2, 2,5 o 5 × 10ⁿ) para cubrir `span` en hasta `count` intervalos. */
function niceStep(span: number, count: number): number {
  const raw = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = STEPS.find((candidate) => candidate * magnitude >= raw) ?? 10;
  return step * magnitude;
}

/**
 * Marcas del eje y que cubren `[min, max]`, con paso redondo y como mucho `count` intervalos.
 * `zero` fuerza que el eje arranque en 0 (barras). Con todos los valores iguales, abre un margen.
 */
export function niceTicks(
  values: readonly number[],
  { count = 2, zero = false }: { count?: number; zero?: boolean } = {},
): number[] {
  if (values.length === 0) return [0, 1];
  let min = zero ? Math.min(0, ...values) : Math.min(...values);
  let max = Math.max(...values);
  if (max === min) {
    const pad = max === 0 ? 1 : Math.abs(max) * 0.1;
    max += pad;
    if (!zero) min -= pad;
  }
  const step = niceStep(max - min, count);
  const first = Math.floor(min / step) * step;
  const last = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  // Se redondea para no arrastrar errores de coma flotante (0,30000000000000004).
  for (let value = first; value <= last + step / 2; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }
  return ticks;
}

/** Índices de los puntos que llevan fecha en el eje x: el primero, el del medio y el último. */
export function labelIndexes(length: number): number[] {
  if (length <= 0) return [];
  return [...new Set([0, Math.floor((length - 1) / 2), length - 1])];
}

/** Un punto de un gráfico por sesión. */
export interface ChartPoint {
  key: string;
  /** `AAAA-MM-DD`. */
  date: string;
  value: number;
  /** El valor formateado (`9,3`, `46,0 mm`). */
  label: string;
}

/** Resumen para `aria-label`: «Puntaje promedio por tiro en 10 sesiones, del 2 ago al 25 oct: de 8,1 a 9,3». */
export function chartSummary(title: string, points: readonly ChartPoint[]): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return `${title}: sin datos`;
  if (points.length === 1) return `${title} el ${formatDayMonth(first.date)}: ${first.label}`;
  return `${title} en ${points.length} sesiones, del ${formatDayMonth(first.date)} al ${formatDayMonth(
    last.date,
  )}: de ${first.label} a ${last.label}`;
}

/** Márgenes del área de dibujo: lugar para las marcas del eje y, el valor destacado y las fechas. */
const PADDING = { left: 32, right: 8, top: 28, bottom: 26 };

export interface ChartLayout {
  width: number;
  height: number;
  ticks: number[];
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Ancho de la franja de cada punto (las barras ocupan una parte; el toque, toda). */
  band: number;
  /** Centro horizontal del punto `index`. */
  x: (index: number) => number;
  /** Altura de un valor. */
  y: (value: number) => number;
}

/** Ubicación de los puntos en un `viewBox` de `width` × `height`. */
export function chartLayout(
  values: readonly number[],
  { width, height, zero = false }: { width: number; height: number; zero?: boolean },
): ChartLayout {
  const ticks = niceTicks(values, { zero });
  const min = ticks[0] ?? 0;
  const max = ticks[ticks.length - 1] ?? 1;
  const left = PADDING.left;
  const right = width - PADDING.right;
  const top = PADDING.top;
  const bottom = height - PADDING.bottom;
  const band = (right - left) / Math.max(values.length, 1);
  return {
    width,
    height,
    ticks,
    left,
    right,
    top,
    bottom,
    band,
    x: (index) => left + band * (index + 0.5),
    y: (value) => bottom - ((value - min) / (max - min || 1)) * (bottom - top),
  };
}
