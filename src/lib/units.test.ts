import { describe, expect, it } from 'vitest';
import { formatLength, fromMm, inchesToMm, mmToInches, parseUnits, toMm } from './units';

describe('conversión mm ↔ pulgadas', () => {
  it('25,4 mm son 1 pulgada', () => {
    expect(mmToInches(25.4)).toBeCloseTo(1);
    expect(inchesToMm(1)).toBeCloseTo(25.4);
  });

  it('ida y vuelta conserva el valor', () => {
    expect(inchesToMm(mmToInches(37.3))).toBeCloseTo(37.3);
  });

  it('fromMm y toMm respetan la unidad elegida', () => {
    expect(fromMm(50.8, 'in')).toBeCloseTo(2);
    expect(fromMm(50.8, 'mm')).toBe(50.8);
    expect(toMm(2, 'in')).toBeCloseTo(50.8);
    expect(toMm(12, 'mm')).toBe(12);
  });
});

describe('formatLength', () => {
  it('en mm usa un decimal y coma decimal', () => {
    expect(formatLength(25.4, 'mm')).toBe('25,4 mm');
    expect(formatLength(1234.56, 'mm')).toBe('1.234,6 mm');
  });

  it('en pulgadas convierte y usa dos decimales', () => {
    expect(formatLength(25.4, 'in')).toBe('1,00 in');
    expect(formatLength(38.1, 'in')).toBe('1,50 in');
  });
});

describe('parseUnits', () => {
  it('acepta mm e in; cualquier otro valor vuelve a mm', () => {
    expect(parseUnits('in')).toBe('in');
    expect(parseUnits('mm')).toBe('mm');
    expect(parseUnits('cm')).toBe('mm');
    expect(parseUnits(undefined)).toBe('mm');
  });
});
