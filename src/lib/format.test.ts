import { describe, expect, it } from 'vitest';
import { formatInteger, formatIsoDate, initials, isoDate } from './format';

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

describe('isoDate', () => {
  it('usa la fecha local, con ceros a la izquierda', () => {
    expect(isoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('formatIsoDate', () => {
  it('muestra la fecha como dd/mm/aaaa', () => {
    expect(formatIsoDate('2023-03-14')).toBe('14/03/2023');
    expect(formatIsoDate('')).toBe('');
  });
});
