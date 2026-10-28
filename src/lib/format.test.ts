import { describe, expect, it } from 'vitest';
import {
  formatDecimal,
  formatInteger,
  formatIsoDate,
  initials,
  isoDate,
  parseDecimal,
} from './format';

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

describe('formatDecimal', () => {
  it('usa coma decimal, hasta un decimal y sin separador de miles', () => {
    expect(formatDecimal(500)).toBe('500');
    expect(formatDecimal(100.5)).toBe('100,5');
    expect(formatDecimal(33.333)).toBe('33,3');
    expect(formatDecimal(1200)).toBe('1200');
  });
});

describe('parseDecimal', () => {
  it('acepta coma o punto decimal', () => {
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(parseDecimal(' 12.5 ')).toBe(12.5);
    expect(parseDecimal('0')).toBe(0);
  });

  it('vacío, negativo o con texto es inválido', () => {
    expect(parseDecimal('')).toBeUndefined();
    expect(parseDecimal('-3')).toBeUndefined();
    expect(parseDecimal('12 mm')).toBeUndefined();
    expect(parseDecimal('1,2,3')).toBeUndefined();
  });
});
