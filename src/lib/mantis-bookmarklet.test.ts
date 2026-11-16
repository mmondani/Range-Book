import { describe, expect, it } from 'vitest';
import { mantisBookmarklet } from './mantis-bookmarklet';

describe('mantisBookmarklet', () => {
  const bookmarklet = mantisBookmarklet();
  const code = decodeURIComponent(bookmarklet.slice('javascript:'.length));

  it('es un link javascript: de una sola línea', () => {
    expect(bookmarklet.startsWith('javascript:')).toBe(true);
    expect(bookmarklet).not.toMatch(/\s/);
    expect(code).not.toContain('\n');
  });

  it('escribe el formato que lee Range Book', () => {
    expect(code).toContain('source: "mantisx"');
    expect(code).toContain('formatVersion: 1');
    expect(code).toContain("'/session-history'");
    expect(code).toContain("'/get-session'");
  });

  it('es JavaScript válido', () => {
    // Solo se compila: no se ejecuta.
    expect(() => new Function(code)).not.toThrow();
  });
});
