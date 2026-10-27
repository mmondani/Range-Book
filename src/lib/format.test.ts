import { describe, expect, it } from 'vitest';
import { formatInteger, initials } from './format';

describe('formatInteger', () => {
  it('usa el punto como separador de miles', () => {
    expect(formatInteger(10552)).toBe('10.552');
    expect(formatInteger(48)).toBe('48');
    expect(formatInteger(0)).toBe('0');
  });
});

describe('initials', () => {
  it('toma la primera letra de las dos primeras palabras', () => {
    expect(initials('juan pablo pérez')).toBe('JP');
  });

  it('funciona con una sola palabra y con espacios extra', () => {
    expect(initials('  ana  ')).toBe('A');
    expect(initials('')).toBe('');
  });
});
