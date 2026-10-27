import { describe, expect, it } from 'vitest';
import { parseThemePreference, resolveTheme } from './theme';

describe('parseThemePreference', () => {
  it('acepta las tres preferencias válidas', () => {
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('system')).toBe('system');
  });

  it('usa el tema oscuro por defecto ante valores vacíos o desconocidos', () => {
    expect(parseThemePreference(null)).toBe('dark');
    expect(parseThemePreference('claro')).toBe('dark');
    expect(parseThemePreference(undefined)).toBe('dark');
  });
});

describe('resolveTheme', () => {
  it('respeta la preferencia explícita sin importar el sistema', () => {
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('light', false)).toBe('light');
  });

  it('con "system" sigue al sistema', () => {
    expect(resolveTheme('system', true)).toBe('light');
    expect(resolveTheme('system', false)).toBe('dark');
  });
});
