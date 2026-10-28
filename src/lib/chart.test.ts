import { describe, expect, it } from 'vitest';
import { chartLayout, chartSummary, labelIndexes, niceTicks } from './chart';

describe('niceTicks', () => {
  it('cubre los valores con pasos redondos', () => {
    expect(niceTicks([8.1, 9.3])).toEqual([8, 9, 10]);
    expect(niceTicks([46, 72], { zero: true })).toEqual([0, 50, 100]);
    expect(niceTicks([0.1, 0.3])).toEqual([0.1, 0.2, 0.3]);
  });

  it('con un solo valor abre un margen alrededor', () => {
    expect(niceTicks([10])).toEqual([9, 10, 11]);
    expect(niceTicks([0], { zero: true })).toEqual([0, 0.5, 1]);
  });

  it('sin valores devuelve un eje de 0 a 1', () => {
    expect(niceTicks([])).toEqual([0, 1]);
  });
});

describe('labelIndexes', () => {
  it('el primero, el del medio y el último, sin repetir', () => {
    expect(labelIndexes(10)).toEqual([0, 4, 9]);
    expect(labelIndexes(2)).toEqual([0, 1]);
    expect(labelIndexes(1)).toEqual([0]);
    expect(labelIndexes(0)).toEqual([]);
  });
});

describe('chartSummary', () => {
  const point = (date: string, label: string) => ({ key: date, date, value: 0, label });

  it('resume la serie para los lectores de pantalla', () => {
    expect(
      chartSummary('Puntaje promedio por tiro', [
        point('2026-08-02', '8,1'),
        point('2026-10-25', '9,3'),
      ]),
    ).toBe('Puntaje promedio por tiro en 2 sesiones, del 2 ago al 25 oct: de 8,1 a 9,3');
    expect(chartSummary('Grupo', [point('2026-10-25', '46,0 mm')])).toBe(
      'Grupo el 25 oct: 46,0 mm',
    );
    expect(chartSummary('Grupo', [])).toBe('Grupo: sin datos');
  });
});

describe('chartLayout', () => {
  it('reparte los puntos en franjas iguales y escala el eje y según las marcas', () => {
    const layout = chartLayout([8.1, 9.3], { width: 340, height: 160 });
    expect(layout.ticks).toEqual([8, 9, 10]);
    expect(layout.band).toBe(150);
    expect(layout.x(0)).toBe(107);
    expect(layout.x(1)).toBe(257);
    expect(layout.y(8)).toBe(layout.bottom);
    expect(layout.y(10)).toBe(layout.top);
  });
});
