import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Round } from '@/lib/sessions';
import { ROUND_1, ROUND_1_ANALYSIS, ROUND_2 } from '@/test/fake-sessions';
import { SessionEvolution } from './session-evolution';

/** Ronda analizada: grupo de `group` mm, PMI en (x, y) y distancia media `center` mm. */
function analyzed(
  id: string,
  { distanceM = 25, group = 40, x = -4, y = -3, center = 20 } = {},
): Round {
  return {
    ...ROUND_1,
    id,
    distanceM,
    analysis: {
      ...ROUND_1_ANALYSIS,
      metrics: {
        ...ROUND_1_ANALYSIS.metrics,
        groupSizeMm: group,
        mpi: { x, y },
        mpiOffsetMm: Math.hypot(x, y),
        meanDistanceMm: center,
      },
    },
  };
}

const TWO_ROUNDS = [
  analyzed('a', { group: 46, x: -4, y: -3, center: 30 }),
  ROUND_2,
  analyzed('c', { group: 35, x: 3, y: 4, center: 21 }),
];

function renderEvolution(rounds: readonly Round[], units: 'mm' | 'in' = 'mm') {
  render(<SessionEvolution rounds={rounds} units={units} headingLevel={2} />);
}

describe('SessionEvolution', () => {
  it('sin rondas analizadas, invita a analizarlas', () => {
    renderEvolution([ROUND_2]);
    expect(
      screen.getByRole('heading', { name: 'Todavía no hay rondas analizadas' }),
    ).toBeInTheDocument();
  });

  it('con una sola ronda analizada, avisa que hacen falta dos', () => {
    renderEvolution([analyzed('a'), ROUND_2]);
    expect(
      screen.getByText('Con dos rondas analizadas o más vas a ver la evolución.'),
    ).toBeInTheDocument();
  });

  it('PMI por defecto: el desvío por ronda y la dispersión de los PMI', () => {
    renderEvolution(TWO_ROUNDS);
    expect(screen.getByText(/Por ronda analizada · 2 de 3/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'PMI' })).toBeChecked();
    expect(screen.getByRole('heading', { name: 'Desvío del PMI (mm)' })).toBeInTheDocument();
    // Las rondas conservan su número en la sesión: la 2 no está analizada.
    expect(
      screen.getByRole('img', {
        name: 'Desvío del PMI por ronda en mm en 2 rondas, del R1 al R3: de 5,0 a 5,0',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'PMI de cada ronda respecto del centro: 1 (-4; -3), 3 (3; 4) mm',
      }),
    ).toBeInTheDocument();
  });

  it('Grupo y Al centro muestran su gráfico, sin la dispersión', async () => {
    renderEvolution(TWO_ROUNDS);
    await userEvent.click(screen.getByRole('radio', { name: 'Grupo' }));
    expect(
      screen.getByRole('img', {
        name: 'Tamaño de grupo por ronda en mm en 2 rondas, del R1 al R3: de 46,0 a 35,0',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /PMI de cada ronda/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Al centro' }));
    expect(
      screen.getByRole('img', {
        name: 'Distancia al centro por ronda en mm en 2 rondas, del R1 al R3: de 30,0 a 21,0',
      }),
    ).toBeInTheDocument();
  });

  it('se puede pasar a MOA, a la distancia de cada ronda', async () => {
    renderEvolution(TWO_ROUNDS);
    await userEvent.click(screen.getByRole('radio', { name: 'MOA' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Grupo' }));
    expect(screen.getByRole('heading', { name: 'Tamaño de grupo (MOA)' })).toBeInTheDocument();
    // 46 mm a 25 m = 6,33 MOA; 35 mm = 4,81 MOA.
    expect(
      screen.getByRole('img', {
        name: 'Tamaño de grupo por ronda en MOA en 2 rondas, del R1 al R3: de 6,33 a 4,81',
      }),
    ).toBeInTheDocument();
  });

  it('con distancias mezcladas arranca en MOA', () => {
    renderEvolution([analyzed('a'), analyzed('b', { distanceM: 50 })]);
    expect(screen.getByRole('radio', { name: 'MOA' })).toBeChecked();
  });

  it('en pulgadas, la unidad del perfil', () => {
    renderEvolution(TWO_ROUNDS, 'in');
    expect(screen.getByRole('radio', { name: 'in' })).toBeChecked();
    expect(screen.getByRole('heading', { name: 'Desvío del PMI (in)' })).toBeInTheDocument();
  });
});
