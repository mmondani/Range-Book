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
