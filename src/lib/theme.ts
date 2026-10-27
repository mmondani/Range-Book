export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

// El script inline de index.html usa la misma clave y los mismos colores.
export const THEME_STORAGE_KEY = 'rb-theme';
export const DEFAULT_THEME: ThemePreference = 'dark';
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  dark: '#0B0D0F',
  light: '#F6F7F8',
};
export const SYSTEM_LIGHT_QUERY = '(prefers-color-scheme: light)';

export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system' ? value : DEFAULT_THEME;
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersLight: boolean,
): ResolvedTheme {
  if (preference === 'system') return systemPrefersLight ? 'light' : 'dark';
  return preference;
}
