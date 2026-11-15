import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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

describe('LineChart con selección (Evolución)', () => {
  const ROUNDS = [
    { ...point('R1', 46), name: 'Ronda 1' },
    { ...point('R2', 52), name: 'Ronda 2' },
    { ...point('R3', 41), name: 'Ronda 3' },
  ];

  function Selectable({ initial = null as number | null }) {
    const [selected, setSelected] = useState<number | null>(initial);
    return (
      <LineChart
        title="Tamaño de grupo por ronda"
        points={ROUNDS}
        height={180}
        formatTick={formatDecimal}
        noun="rondas"
        selectedIndex={selected}
        onSelect={setSelected}
      />
    );
  }

  const band = () => screen.queryByTestId('selection-band');

  it('cada ronda es un botón; tocarla la selecciona y tocarla de nuevo la quita', async () => {
    setAvailableWidth(600);
    render(<Selectable />);
    const chart = screen.getByRole('group', { name: /^Tamaño de grupo por ronda/ });
    expect(band()).not.toBeInTheDocument();
    await userEvent.click(within(chart).getByRole('button', { name: 'Ronda 2' }));
    expect(within(chart).getByRole('button', { name: 'Ronda 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // La banda va detrás de la ronda 2: centrada en su franja (600 / 3 = 200 px), de 44 px.
    expect(band()).toHaveAttribute('x', String(300 - 22));
    expect(band()).toHaveAttribute('width', '44');
    expect(within(chart).getByText('R2')).toHaveClass(/activeLabel/);

    await userEvent.click(within(chart).getByRole('button', { name: 'Ronda 2' }));
    expect(band()).not.toBeInTheDocument();
  });

  it('el mouse destaca otra ronda sin mover la banda ni apagar la seleccionada', () => {
    setAvailableWidth(600);
    render(<Selectable initial={0} />);
    const chart = screen.getByRole('group', { name: /^Tamaño de grupo por ronda/ });
    const x = band()!.getAttribute('x');
    fireEvent.pointerEnter(within(chart).getByRole('button', { name: 'Ronda 3' }), {
      pointerType: 'mouse',
    });
    expect(within(chart).getByText('R3')).toHaveClass(/activeLabel/);
    expect(within(chart).getByText('R1')).toHaveClass(/activeLabel/);
    expect(within(chart).getByText(formatDecimal(46))).toHaveClass(/activeLabel/);
    expect(band()).toHaveAttribute('x', x);
    expect(within(chart).getByRole('button', { name: 'Ronda 3' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('con el teclado: Enter o Espacio seleccionan y Escape quita la selección', async () => {
    setAvailableWidth(600);
    render(<Selectable />);
    const chart = screen.getByRole('group', { name: /^Tamaño de grupo por ronda/ });
    within(chart).getByRole('button', { name: 'Ronda 1' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(band()).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(band()).not.toBeInTheDocument();
    await userEvent.keyboard(' ');
    expect(within(chart).getByRole('button', { name: 'Ronda 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('si la seleccionada queda fuera de lo que se ve, se desplaza hasta ella', () => {
    // 3 puntos de 52 px en 100 px: arranca mostrando el final.
    setAvailableWidth(100);
    const scrollTo = vi.fn();
    vi.spyOn(HTMLElement.prototype, 'scrollLeft', 'set').mockImplementation(scrollTo);
    vi.spyOn(HTMLElement.prototype, 'scrollLeft', 'get').mockReturnValue(MIN_BAND * 3 - 100);
    render(<Selectable initial={0} />);
    // La ronda 1 está en x = 26: queda en el medio (26 − 50 → 0 o menos).
    expect(scrollTo).toHaveBeenLastCalledWith(26 - 50);
  });
});
