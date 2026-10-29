/**
 * Escalas de los gráficos de línea (`LineChart`): marcas "redondas" del eje y, ancho del área
 * de dibujo y qué puntos llevan etiqueta en el eje x.
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
 * Con todos los valores iguales, abre un margen.
 */
export function niceTicks(values: readonly number[], count = 2): number[] {
  if (values.length === 0) return [0, 1];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max === min) {
    const pad = max === 0 ? 1 : Math.abs(max) * 0.1;
    max += pad;
    min -= pad;
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

/** Un punto de un gráfico: una sesión o una ronda. */
export interface ChartPoint {
  key: string;
  /** Etiqueta del eje x: la fecha (`2 ago`) o la ronda (`R1`). */
  axisLabel: string;
  value: number;
  /** El valor formateado, sin unidad (`9,3`, `46,0`). */
  label: string;
}

/**
 * Resumen para `aria-label`: «Puntaje promedio por tiro en 10 sesiones, del 2 ago al 25 oct: de
 * 8,1 a 9,3». `noun` es lo que representa cada punto, en plural.
 */
export function chartSummary(
  title: string,
  points: readonly ChartPoint[],
  noun = 'sesiones',
): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return `${title}: sin datos`;
  if (points.length === 1) return `${title}, ${first.axisLabel}: ${first.label}`;
  return `${title} en ${points.length} ${noun}, del ${first.axisLabel} al ${last.axisLabel}: de ${
    first.label
  } a ${last.label}`;
}

/** Ancho mínimo de cada punto: lo que ocupa su valor sin pisar al de al lado. */
export const MIN_BAND = 52;

/** Ancho del eje y, que queda fijo a la izquierda mientras el gráfico se desplaza. */
export const Y_AXIS_WIDTH = 34;

/** Lo que ocupa una fecha del eje x (`25 oct`). */
const AXIS_LABEL_WIDTH = 56;

/** Ancho del área de dibujo: todo el disponible o, si los puntos no entran, el mínimo por punto. */
export function chartWidth(count: number, available: number): number {
  return Math.max(available, count * MIN_BAND);
}

/**
 * Índices de los puntos que llevan su etiqueta en el eje x: el destacado siempre y, del resto,
 * los que entran sin superponerse, contando desde el último.
 */
export function axisLabelIndexes(count: number, band: number, active: number): number[] {
  const every = Math.max(1, Math.ceil(AXIS_LABEL_WIDTH / band));
  const indexes: number[] = [];
  for (let index = 0; index < count; index++) {
    const regular = (count - 1 - index) % every === 0 && Math.abs(index - active) >= every;
    if (index === active || regular) indexes.push(index);
  }
  return indexes;
}

/** Márgenes del área de dibujo: lugar para los valores arriba y las etiquetas del eje x abajo. */
const PADDING = { top: 28, bottom: 26 };

export interface ChartLayout {
  width: number;
  height: number;
  ticks: number[];
  top: number;
  bottom: number;
  /** Ancho de la franja de cada punto (el toque ocupa toda la franja). */
  band: number;
  /** Centro horizontal del punto `index`. */
  x: (index: number) => number;
  /** Altura de un valor. */
  y: (value: number) => number;
}

/** Ubicación de los puntos en un área de `width` × `height` px. */
export function chartLayout(
  values: readonly number[],
  { width, height }: { width: number; height: number },
): ChartLayout {
  const ticks = niceTicks(values);
  const min = ticks[0] ?? 0;
  const max = ticks[ticks.length - 1] ?? 1;
  const top = PADDING.top;
  const bottom = height - PADDING.bottom;
  const band = width / Math.max(values.length, 1);
  return {
    width,
    height,
    ticks,
    top,
    bottom,
    band,
    x: (index) => band * (index + 0.5),
    y: (value) => bottom - ((value - min) / (max - min || 1)) * (bottom - top),
  };
}
