import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Round } from '@/lib/sessions';
import { ROUND_1, ROUND_1_ANALYSIS, ROUND_2 } from '@/test/fake-sessions';
import { SessionEvolution } from './session-evolution';

/** Ronda analizada: grupo de `group` mm, PMI en (x, y) y radio medio `radius` mm. */
function analyzed(
  id: string,
  { distanceM = 25, group = 40 as number | null, x = -4, y = -3, radius = 20 } = {},
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
        meanRadiusMm: radius,
      },
    },
  };
}

const TWO_ROUNDS = [
  analyzed('a', { group: 46, x: -4, y: -3, radius: 30 }),
  ROUND_2,
  analyzed('c', { group: 35, x: 3, y: 4, radius: 21 }),
];

const analysisPath = (roundId: string) => `/sesiones/s/rondas/${roundId}/analisis`;

function renderEvolution(rounds: readonly Round[], units: 'mm' | 'in' = 'mm') {
  render(
    <MemoryRouter>
      <SessionEvolution
        rounds={rounds}
        units={units}
        headingLevel={2}
        analysisPath={analysisPath}
      />
    </MemoryRouter>,
  );
}

const choose = (name: string) => userEvent.click(screen.getByRole('radio', { name }));
/** La dispersión (un grupo con un botón por ronda). */
const scatter = (name: RegExp) => screen.getByRole('group', { name });
/** El gráfico de línea (un grupo con un botón por ronda). */
const line = (name: RegExp) => screen.getByRole('group', { name });
const strip = () =>
  screen
    .getAllByRole('status')
    .find((item) => /Tocá un punto|Ronda \d/.test(item.textContent ?? ''))!;

describe('SessionEvolution', () => {
  it('sin rondas analizadas, invita a analizarlas', () => {
    renderEvolution([ROUND_2]);
    expect(
      screen.getByRole('heading', { name: 'Todavía no hay rondas analizadas' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/el PMI, el grupo y el radio medio/)).toBeInTheDocument();
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
      line(/^Desvío del PMI por ronda en mm en 2 rondas, del R1 al R3: de 5,0 a 5,0$/),
    ).toBeInTheDocument();
    expect(
      scatter(/^PMI de cada ronda respecto del centro: 1 \(-4; -3\), 3 \(3; 4\) mm$/),
    ).toBeInTheDocument();
    expect(strip()).toHaveTextContent(
      'Tocá un punto para ver esa ronda. Pellizcá el gráfico para acercarlo.',
    );
  });

  it('Grupo y Radio medio muestran su línea y la dispersión con un círculo por ronda', async () => {
    renderEvolution(TWO_ROUNDS);
    await choose('Grupo');
    expect(
      line(/^Tamaño de grupo por ronda en mm en 2 rondas, del R1 al R3: de 46,0 a 35,0$/),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Grupo de cada ronda' })).toBeInTheDocument();
    expect(
      scatter(
        /^Grupo de cada ronda alrededor de su PMI: 1 \(-4; -3\) grupo 46, 3 \(3; 4\) grupo 35/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Cada círculo está centrado en el PMI de la ronda y su diámetro es el tamaño de grupo.',
      ),
    ).toBeInTheDocument();

    await choose('Radio medio');
    expect(screen.queryByRole('radio', { name: 'Al centro' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Radio medio (mm)' })).toBeInTheDocument();
    expect(
      line(/^Radio medio por ronda en mm en 2 rondas, del R1 al R3: de 30,0 a 21,0$/),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Radio medio de cada ronda' })).toBeInTheDocument();
    expect(scatter(/radio medio 30, 3 \(3; 4\) radio medio 21 mm$/)).toBeInTheDocument();
    expect(screen.getByText(/su radio es el radio medio/)).toBeInTheDocument();
  });

  it('una ronda sin grupo (menos de 2 impactos) se ve en la dispersión de Grupo, sin círculo', async () => {
    renderEvolution([analyzed('a', { group: 46 }), analyzed('b', { group: null, x: 1, y: 1 })]);
    await choose('Grupo');
    const chart = scatter(/^Grupo de cada ronda/);
    expect(chart).toHaveAccessibleName(/2 \(1; 1\) mm$/);
    expect(within(chart).getByRole('button', { name: 'Ronda 2' })).toBeInTheDocument();
  });

  it('se puede pasar a MOA, a la distancia de cada ronda', async () => {
    renderEvolution(TWO_ROUNDS);
    await choose('MOA');
    await choose('Grupo');
    expect(screen.getByRole('heading', { name: 'Tamaño de grupo (MOA)' })).toBeInTheDocument();
    // 46 mm a 25 m = 6,33 MOA; 35 mm = 4,81 MOA.
    expect(
      line(/^Tamaño de grupo por ronda en MOA en 2 rondas, del R1 al R3: de 6,33 a 4,81$/),
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

describe('SessionEvolution · selección de una ronda', () => {
  it('tocar un PMI lo selecciona, muestra la ronda y lleva a su análisis', async () => {
    renderEvolution(TWO_ROUNDS);
    const chart = scatter(/^PMI de cada ronda/);
    await userEvent.click(within(chart).getByRole('button', { name: 'Ronda 3' }));
    expect(within(chart).getByRole('button', { name: 'Ronda 3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(chart).getByRole('button', { name: 'Ronda 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(strip()).toHaveTextContent('Ronda 3PMI (3,0; 4,0) mm');
    expect(screen.getByRole('link', { name: 'Ver análisis de la ronda 3' })).toHaveAttribute(
      'href',
      analysisPath('c'),
    );

    // Tocar el mismo punto quita la selección.
    await userEvent.click(within(chart).getByRole('button', { name: 'Ronda 3' }));
    expect(strip()).toHaveTextContent('Tocá un punto para ver esa ronda.');
  });

  it('tocar un lugar vacío del gráfico o Escape quita la selección', async () => {
    renderEvolution(TWO_ROUNDS);
    const chart = scatter(/^PMI de cada ronda/);
    await userEvent.click(within(chart).getByRole('button', { name: 'Ronda 1' }));
    await userEvent.click(chart);
    expect(strip()).toHaveTextContent('Tocá un punto');

    // Con el teclado: Tab hasta el punto, Enter lo selecciona y Escape lo quita.
    within(chart).getByRole('button', { name: 'Ronda 1' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(strip()).toHaveTextContent('Ronda 1');
    await userEvent.keyboard('{Escape}');
    expect(strip()).toHaveTextContent('Tocá un punto');
  });

  it('la ronda seleccionada sigue seleccionada en las otras pestañas y unidades', async () => {
    renderEvolution(TWO_ROUNDS);
    await userEvent.click(
      within(scatter(/^PMI de cada ronda/)).getByRole('button', { name: 'Ronda 3' }),
    );
    await choose('Grupo');
    expect(
      within(scatter(/^Grupo de cada ronda/)).getByRole('button', { name: 'Ronda 3' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(strip()).toHaveTextContent('Ronda 3PMI (3,0; 4,0) · Grupo 35,0 mm');

    await choose('Radio medio');
    expect(strip()).toHaveTextContent('Ronda 3PMI (3,0; 4,0) · Radio medio 21,0 mm');

    await choose('MOA');
    // 21 mm a 25 m = 2,89 MOA.
    expect(strip()).toHaveTextContent('· Radio medio 2,89 MOA');
    expect(
      within(line(/^Radio medio por ronda en MOA/)).getByRole('button', { name: 'Ronda 3' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('tocar una ronda en la línea la selecciona en la dispersión, y tocarla de nuevo la quita', async () => {
    renderEvolution(TWO_ROUNDS);
    const chart = line(/^Desvío del PMI por ronda/);
    await userEvent.click(within(chart).getByRole('button', { name: 'Ronda 1' }));
    expect(within(chart).getByRole('button', { name: 'Ronda 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      within(scatter(/^PMI de cada ronda/)).getByRole('button', { name: 'Ronda 1' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(strip()).toHaveTextContent('Ronda 1');
    expect(screen.getByTestId('selection-band')).toBeInTheDocument();

    await userEvent.click(within(chart).getByRole('button', { name: 'Ronda 1' }));
    expect(strip()).toHaveTextContent('Tocá un punto');
    expect(screen.queryByTestId('selection-band')).not.toBeInTheDocument();
  });

  it('el zoom vuelve a 1× al cambiar de métrica o de unidad; la selección se mantiene', async () => {
    renderEvolution(TWO_ROUNDS);
    await userEvent.click(
      within(scatter(/^PMI de cada ronda/)).getByRole('button', { name: 'Ronda 1' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Acercar' }));
    // El nivel se anuncia (aria-live); el botón "1×" restablece.
    const level = () =>
      screen.getByRole('group', { name: 'Zoom del gráfico' }).querySelector('[aria-live]');
    expect(level()).toHaveTextContent('1,6×');
    // Con zoom, la selección se mantiene.
    expect(strip()).toHaveTextContent('Ronda 1');

    await choose('Grupo');
    expect(level()).toHaveTextContent('1×');
    expect(strip()).toHaveTextContent('Ronda 1');

    await userEvent.click(screen.getByRole('button', { name: 'Acercar' }));
    await choose('MOA');
    expect(level()).toHaveTextContent('1×');
  });
});
