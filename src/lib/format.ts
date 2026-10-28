const integerFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

/** Entero con separador de miles `es-AR`: `10.552`. */
export function formatInteger(value: number): string {
  return integerFormat.format(value);
}

/** Iniciales para el avatar: primera letra de las dos primeras palabras. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toLocaleUpperCase('es-AR') ?? '')
    .join('');
}

/** Fecha local en `AAAA-MM-DD`, el formato de `<input type="date">`. */
export function isoDate(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `2023-03-14` → `14/03/2023`. */
export function formatIsoDate(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

const decimalFormat = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 1,
  useGrouping: false,
});

/** Número con hasta un decimal y coma decimal, sin separador de miles: `12,5`. */
export function formatDecimal(value: number): string {
  return decimalFormat.format(value);
}

/**
 * Número positivo o cero escrito a mano; acepta coma o punto decimal (`12,5`, `12.5`).
 * `undefined` si está vacío o no es un número.
 */
export function parseDecimal(value: string): number | undefined {
  const text = value.trim();
  if (!/^\d+([.,]\d+)?$/.test(text)) return undefined;
  return Number(text.replace(',', '.'));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `AAAA-MM-DD` con una fecha que existe (`2026-02-30` no). */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

const WEEKDAYS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const;

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase('es-AR') + text.slice(1);

function dateParts(value: string) {
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month: MONTHS[month - 1] ?? '', day, weekday: WEEKDAYS[weekday] ?? '' };
}

/** `2026-10` o `2026-10-25` → `Octubre 2026`. */
export function formatMonthYear(value: string): string {
  const { year, month } = dateParts(value.length === 7 ? `${value}-01` : value);
  return `${capitalize(month)} ${year}`;
}

/** `2026-10-25` → `Oct` (para el bloque de fecha de las tarjetas). */
export function formatShortMonth(value: string): string {
  return capitalize(dateParts(value).month.slice(0, 3));
}

/** `2026-10-25` → `Sáb 25 oct 2026`. */
export function formatShortDate(value: string): string {
  const { year, month, day, weekday } = dateParts(value);
  return `${capitalize(weekday.slice(0, 3))} ${day} ${month.slice(0, 3)} ${year}`;
}

/** `2026-08-02` → `2 ago` (ejes de los gráficos). */
export function formatDayMonth(value: string): string {
  const { month, day } = dateParts(value);
  return `${day} ${month.slice(0, 3)}`;
}

/** `2026-10-25` → `Sábado 25 de octubre de 2026`. */
export function formatLongDate(value: string): string {
  const { year, month, day, weekday } = dateParts(value);
  return `${capitalize(weekday)} ${day} de ${month} de ${year}`;
}
