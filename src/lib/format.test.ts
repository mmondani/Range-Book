import { describe, expect, it } from 'vitest';
import { initials } from './format';

describe('initials', () => {
  it('toma la primera letra de las dos primeras palabras', () => {
    expect(initials('juan pablo pérez')).toBe('JP');
  });

  it('funciona con una sola palabra y con espacios extra', () => {
    expect(initials('  ana  ')).toBe('A');
    expect(initials('')).toBe('');
  });
});
