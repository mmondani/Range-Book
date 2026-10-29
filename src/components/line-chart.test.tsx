import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MIN_BAND, type ChartPoint } from '@/lib/chart';
import { formatDecimal } from '@/lib/format';
import { LineChart } from './line-chart';

const point = (axisLabel: string, value: number): ChartPoint => ({
  key: axisLabel,
  axisLabel,
  value,
  label: formatDecimal(value),
});

const POINTS = [point('2 ago', 8.1), point('13 sep', 8.7), point('25 oct', 9.3)];

function renderChart(points: readonly ChartPoint[] = POINTS) {
  render(
    <LineChart
      title="Puntaje promedio por tiro"
      points={points}
      height={180}
      formatTick={formatDecimal}
    />,
  );
  return screen.getByRole('img', { name: /Puntaje promedio por tiro/ });
}

/** Ancho disponible para el gráfico (jsdom no mide: por defecto es 0). */
function setAvailableWidth(width: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LineChart', () => {
  it('muestra el valor de cada punto, no solo el del destacado', () => {
    setAvailableWidth(600);
    const chart = renderChart();
    for (const label of ['8,1', '8,7', '9,3']) {
      expect(within(chart).getByText(label)).toBeInTheDocument();
    }
  });

  it('destaca el último y, al tocar otro, ese muestra su fecha', () => {
    setAvailableWidth(600);
    const chart = renderChart();
    expect(within(chart).getByText('25 oct')).toHaveClass(/activeLabel/);

    const hits = chart.querySelectorAll('rect');
    fireEvent.click(hits[0]!);
    expect(within(chart).getByText('2 ago')).toHaveClass(/activeLabel/);
    expect(within(chart).getByText('8,1')).toHaveClass(/activeLabel/);
    expect(within(chart).getByText('9,3')).not.toHaveClass(/activeLabel/);
  });

  it('si los puntos entran, ocupa el ancho disponible y no se desplaza', () => {
    setAvailableWidth(600);
    const chart = renderChart();
    expect(chart).toHaveAttribute('width', '600');
    expect(chart.parentElement).not.toHaveAttribute('tabindex');
  });

  it('si no entran, cada punto ocupa el mínimo y el gráfico se desplaza (también con el teclado)', () => {
    setAvailableWidth(320);
    const points = Array.from({ length: 20 }, (_, index) =>
      point(`${index + 1} oct`, 8 + index / 20),
    );
    const chart = renderChart(points);
    expect(chart).toHaveAttribute('width', String(20 * MIN_BAND));
    expect(chart.parentElement).toHaveAttribute('tabindex', '0');
    // Todos los valores siguen a la vista.
    expect(within(chart).getAllByText(/^\d+,\d$|^\d+$/)).toHaveLength(20);
  });

  it('resume la serie para los lectores de pantalla', () => {
    renderChart();
    expect(
      screen.getByRole('img', {
        name: 'Puntaje promedio por tiro en 3 sesiones, del 2 ago al 25 oct: de 8,1 a 9,3',
      }),
    ).toBeInTheDocument();
  });
});
