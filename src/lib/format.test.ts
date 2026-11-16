import { describe, expect, it } from 'vitest';
import {
  formatDayMonthYear,
  formatNumericDayMonth,
  formatWeekdayDayMonth,
  formatFixed,
  formatTime,
  formatDecimal,
  formatInteger,
  formatIsoDate,
  formatDayMonth,
  formatLongDate,
  formatMonthYear,
  formatShortDate,
  formatShortMonth,
  initials,
  isoDate,
  isValidIsoDate,
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

describe('fechas de las sesiones', () => {
  it('valida fechas AAAA-MM-DD que existen', () => {
    expect(isValidIsoDate('2026-10-25')).toBe(true);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('25/10/2026')).toBe(false);
  });

  it('formatea mes, día de la semana y fecha larga', () => {
    expect(formatMonthYear('2026-10')).toBe('Octubre 2026');
    expect(formatMonthYear('2026-09-27')).toBe('Septiembre 2026');
    expect(formatShortMonth('2026-10-25')).toBe('Oct');
    expect(formatShortDate('2026-10-25')).toBe('Dom 25 oct 2026');
    expect(formatLongDate('2026-10-24')).toBe('Sábado 24 de octubre de 2026');
    expect(formatDayMonth('2026-08-02')).toBe('2 ago');
    expect(formatLongDate('2026-03-02')).toBe('Lunes 2 de marzo de 2026');
  });
});

describe('formatFixed', () => {
  it('usa los decimales fijos y coma decimal', () => {
    expect(formatFixed(3.9, 2)).toBe('3,90');
    expect(formatFixed(93, 1)).toBe('93,0');
    expect(formatFixed(1234.5, 1)).toBe('1234,5');
  });
});

describe('formatTime', () => {
  it('muestra la hora local de un instante', () => {
    expect(formatTime(new Date(2026, 10, 15, 9, 5).toISOString())).toBe('09:05');
  });
});

describe('fechas cortas de MantisX', () => {
  it('muestran el día de la semana y el día, o solo día y mes en números', () => {
    expect(formatWeekdayDayMonth('2026-11-15')).toBe('Dom 15 nov');
    expect(formatNumericDayMonth('2026-10-31')).toBe('31/10');
    expect(formatDayMonthYear('2026-11-15')).toBe('15 nov 2026');
  });
});
