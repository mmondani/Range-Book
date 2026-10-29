/**
 * Unidades en que se muestran las medidas del análisis (grupo, PMI, distancia al centro).
 * Internamente todo se guarda en mm; la distancia de tiro va siempre en metros.
 */
export type Units = 'mm' | 'in';

export const DEFAULT_UNITS: Units = 'mm';
export const MM_PER_INCH = 25.4;

export const UNIT_SYMBOLS: Record<Units, string> = {
  mm: 'mm',
  in: 'in',
};

/** Decimales con que se muestra cada unidad: 1 mm ≈ 0,04 in, así que las pulgadas llevan 2. */
export const UNIT_DECIMALS: Record<Units, number> = {
  mm: 1,
  in: 2,
};

export function parseUnits(value: unknown): Units {
  return value === 'mm' || value === 'in' ? value : DEFAULT_UNITS;
}

export function mmToInches(mm: number): number {
  return mm / MM_PER_INCH;
}

export function inchesToMm(inches: number): number {
  return inches * MM_PER_INCH;
}

/** Convierte una medida guardada en mm a la unidad elegida. */
export function fromMm(mm: number, units: Units): number {
  return units === 'in' ? mmToInches(mm) : mm;
}

/** Convierte una medida ingresada en la unidad elegida a mm. */
export function toMm(value: number, units: Units): number {
  return units === 'in' ? inchesToMm(value) : value;
}

/** Número de una medida en mm, en la unidad elegida y con formato `es-AR`: `25,4`, `1,00`. */
export function formatLengthValue(mm: number, units: Units): string {
  const decimals = UNIT_DECIMALS[units];
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(fromMm(mm, units));
}

/** Medida en mm formateada en la unidad elegida, con formato `es-AR`: `25,4 mm`, `1,00 in`. */
export function formatLength(mm: number, units: Units): string {
  return `${formatLengthValue(mm, units)} ${UNIT_SYMBOLS[units]}`;
}

/**
 * Coordenada en mm con signo explícito, en la unidad elegida: `+3,2`, `−12,8` (signo menos
 * tipográfico), `0,0`. Lo que redondea a 0 va sin signo.
 */
export function formatSignedLength(mm: number, units: Units): string {
  const text = formatLengthValue(Math.abs(mm), units);
  if (Number(fromMm(Math.abs(mm), units).toFixed(UNIT_DECIMALS[units])) === 0) return text;
  return `${mm > 0 ? '+' : '−'}${text}`;
}
