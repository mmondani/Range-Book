import { describe, expect, it } from 'vitest';
import {
  axisLabelIndexes,
  chartLayout,
  chartSummary,
  chartWidth,
  MIN_BAND,
  niceTicks,
  scatterRings,
} from './chart';

describe('niceTicks', () => {
  it('cubre los valores con pasos redondos', () => {
    expect(niceTicks([8.1, 9.3])).toEqual([8, 9, 10]);
    expect(niceTicks([46, 72])).toEqual([40, 60, 80]);
    expect(niceTicks([0.1, 0.3])).toEqual([0.1, 0.2, 0.3]);
  });

  it('con un solo valor abre un margen alrededor', () => {
    expect(niceTicks([10])).toEqual([9, 10, 11]);
  });

  it('sin valores devuelve un eje de 0 a 1', () => {
    expect(niceTicks([])).toEqual([0, 1]);
  });
});

describe('chartSummary', () => {
  const point = (axisLabel: string, label: string) => ({
    key: axisLabel,
    axisLabel,
    value: 0,
    label,
  });

  it('resume la serie para los lectores de pantalla', () => {
    expect(
      chartSummary('Puntaje promedio por tiro', [point('2 ago', '8,1'), point('25 oct', '9,3')]),
    ).toBe('Puntaje promedio por tiro en 2 sesiones, del 2 ago al 25 oct: de 8,1 a 9,3');
    expect(chartSummary('Grupo', [point('25 oct', '46,0')])).toBe('Grupo, 25 oct: 46,0');
    expect(chartSummary('Grupo', [])).toBe('Grupo: sin datos');
  });

  it('dice qué representa cada punto', () => {
    expect(chartSummary('Grupo', [point('R1', '46'), point('R3', '35')], 'rondas')).toBe(
      'Grupo en 2 rondas, del R1 al R3: de 46 a 35',
    );
  });
});

describe('chartWidth', () => {
  it('ocupa todo el ancho disponible si los puntos entran', () => {
    expect(chartWidth(5, 320)).toBe(320);
  });

  it('si no entran, cada punto ocupa el mínimo y el gráfico se desplaza', () => {
    expect(chartWidth(20, 320)).toBe(20 * MIN_BAND);
  });
});

describe('axisLabelIndexes', () => {
  it('con lugar de sobra, todas las etiquetas', () => {
    expect(axisLabelIndexes(4, 80, 3)).toEqual([0, 1, 2, 3]);
  });

  it('con poco lugar, una de cada tantas contando desde la última', () => {
    // 52 px por punto: una de cada dos.
    expect(axisLabelIndexes(6, 52, 5)).toEqual([1, 3, 5]);
  });

  it('el destacado siempre lleva la suya y saca a las que lo pisarían', () => {
    expect(axisLabelIndexes(6, 52, 2)).toEqual([2, 5]);
  });
});

describe('chartLayout', () => {
  it('reparte los puntos en franjas iguales y escala el eje y según las marcas', () => {
    const layout = chartLayout([8.1, 9.3], { width: 300, height: 160 });
    expect(layout.ticks).toEqual([8, 9, 10]);
    expect(layout.band).toBe(150);
    expect(layout.x(0)).toBe(75);
    expect(layout.x(1)).toBe(225);
    expect(layout.y(8)).toBe(layout.bottom);
    expect(layout.y(10)).toBe(layout.top);
  });
});

describe('scatterRings', () => {
  it('un radio redondo y su doble, que alcanza para el punto más alejado', () => {
    expect(scatterRings(14)).toEqual([10, 20]);
    expect(scatterRings(30)).toEqual([20, 40]);
    expect(scatterRings(1.3)).toEqual([1, 2]);
  });

  it('con todo en el centro, igual dibuja una referencia', () => {
    expect(scatterRings(0)).toEqual([1, 2]);
  });
});
