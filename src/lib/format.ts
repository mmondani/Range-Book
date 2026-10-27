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
