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
