import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { MpiScatter, type MpiScatterPoint } from './mpi-scatter';

const POINTS: MpiScatterPoint[] = [
  { key: 'a', label: '1', x: -4, y: -3, radius: 10, detail: 'grupo 20' },
  { key: 'b', label: '2', x: 0, y: 0, radius: null },
  { key: 'c', label: '3', x: 3, y: 4, radius: 6, detail: 'grupo 12' },
];

const format = (value: number) => String(value);

function Selectable({ points = POINTS }: { points?: MpiScatterPoint[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <MpiScatter
      points={points}
      unit="mm"
      format={format}
      title="Grupo de cada ronda"
      selectedKey={selected}
      onSelect={setSelected}
    />
  );
}

/** Los círculos de cada ronda (punteados), sin los de referencia ni los puntos. */
const roundCircles = (container: HTMLElement) =>
  [...container.querySelectorAll('circle')].filter((circle) =>
    circle.getAttribute('class')?.includes('circle'),
  );

describe('MpiScatter', () => {
  it('sin selección, es una imagen con su resumen y sin botones', () => {
    render(<MpiScatter points={POINTS} unit="mm" format={format} title="PMI de cada ronda" />);
    expect(
      screen.getByRole('img', {
        name: 'PMI de cada ronda: 1 (-4; -3) grupo 20, 2 (0; 0), 3 (3; 4) grupo 12 mm',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Zoom del gráfico' })).not.toBeInTheDocument();
  });

  it('dibuja un círculo por ronda que lo tiene, centrado en su PMI', () => {
    const { container } = render(<Selectable />);
    const circles = roundCircles(container);
    expect(circles).toHaveLength(2);
    // El de la ronda 1 es más grande que el de la 3 (10 contra 6).
    const [first, third] = circles.map((circle) => Number(circle.getAttribute('r')));
    expect(first! / third!).toBeCloseTo(10 / 6);
  });

  it('los círculos entran en la escala: la referencia mayor alcanza al borde más alejado', () => {
    render(<Selectable />);
    // El círculo de la ronda 1 llega a 5 + 10 = 15 mm del centro: referencias de 10 y 20 mm.
    const labels = [...document.querySelectorAll('text')].map((text) => text.textContent);
    expect(labels).toEqual(expect.arrayContaining(['10 mm', '20 mm']));
  });

  it('tocar un punto lo selecciona; los demás se opacan', async () => {
    const { container } = render(<Selectable />);
    const chart = screen.getByRole('group', { name: /^Grupo de cada ronda/ });
    await userEvent.click(within(chart).getByRole('button', { name: 'Ronda 1' }));
    expect(within(chart).getByRole('button', { name: 'Ronda 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const [selected, other] = roundCircles(container);
    expect(selected!.getAttribute('class')).toMatch(/selectedCircle/);
    expect(other!.getAttribute('class')).toMatch(/dimmed/);
    expect(within(chart).getByRole('button', { name: 'Ronda 3' }).getAttribute('class')).toMatch(
      /dimmed/,
    );
  });

  it('los botones de zoom acercan, alejan y restablecen; se deshabilitan en los límites', async () => {
    render(<Selectable />);
    const controls = within(screen.getByRole('group', { name: 'Zoom del gráfico' }));
    const level = () =>
      screen.getByRole('group', { name: 'Zoom del gráfico' }).querySelector('[aria-live]');
    expect(level()).toHaveTextContent('1×');
    expect(controls.getByRole('button', { name: 'Alejar' })).toBeDisabled();
    expect(controls.getByRole('button', { name: 'Restablecer el zoom' })).toBeDisabled();

    await userEvent.click(controls.getByRole('button', { name: 'Acercar' }));
    await userEvent.click(controls.getByRole('button', { name: 'Acercar' }));
    expect(level()).toHaveTextContent('2,6×');
    // Con zoom, las referencias bajan a la escala visible.
    const labels = [...document.querySelectorAll('text')].map((text) => text.textContent);
    expect(labels).toEqual(expect.arrayContaining(['5 mm', '10 mm']));

    await userEvent.click(controls.getByRole('button', { name: 'Alejar' }));
    expect(level()).toHaveTextContent('1,6×');
    await userEvent.click(controls.getByRole('button', { name: 'Restablecer el zoom' }));
    expect(level()).toHaveTextContent('1×');

    for (let i = 0; i < 6; i++)
      await userEvent.click(controls.getByRole('button', { name: 'Acercar' }));
    expect(level()).toHaveTextContent('10×');
    expect(controls.getByRole('button', { name: 'Acercar' })).toBeDisabled();
  });

  it('los puntos, sus números y los trazos no se agrandan con el zoom: solo se separan', async () => {
    render(<Selectable />);
    const chart = screen.getByRole('group', { name: /^Grupo de cada ronda/ });
    const dot = () =>
      within(chart).getByRole('button', { name: 'Ronda 3' }).querySelector('g circle')!;
    const [r1, x1] = [dot().getAttribute('r'), Number(dot().getAttribute('cx'))];
    await userEvent.click(screen.getByRole('button', { name: 'Acercar' }));
    expect(dot().getAttribute('r')).toBe(r1);
    // La ronda 3 está a la derecha del centro: se aleja de él.
    expect(Number(dot().getAttribute('cx'))).toBeGreaterThan(x1);
  });
});
