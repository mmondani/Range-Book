import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseAnalysis } from '@/lib/analysis';
import type { Round, Session } from '@/lib/sessions';
import { TODAY } from '@/test/fake-sessions';
import { setDesktop } from '@/test/match-media';
import { renderSessions } from '@/test/render-sessions';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
  setDesktop(false);
});

const analysis = (groupSizeMm: number, mpiY: number, impacts: number) =>
  parseAnalysis({ metrics: { impacts, groupSizeMm, mpi: { x: 0, y: mpiY } } });

const round = (overrides: Partial<Round>): Round => ({
  id: 'r',
  targetId: 'issf',
  distanceM: 25,
  shots: 10,
  manualScore: null,
  score: null,
  photo: null,
  comments: '',
  analysis: null,
  ...overrides,
});

const session = (overrides: Partial<Session>): Session => ({
  id: 's',
  date: '2026-10-20',
  firearmId: 'glock',
  configurationId: 'ipsc',
  modificationsSnapshot: [],
  rangeId: 'norte',
  weather: null,
  ammunitionId: 'magtech',
  photos: [],
  notes: '',
  rounds: [],
  ...overrides,
});

/**
 * Últimos 90 días (hoy es 28/10/2026): A y B, a 25 m (la distancia más usada). A también tiene una
 * ronda a 10 m sin analizar. C es del período anterior.
 */
const SESSION_A = session({
  id: 'a',
  date: '2026-10-20',
  rounds: [
    round({ id: 'a1', shots: 10, manualScore: 92, analysis: analysis(40, -10, 10) }),
    round({ id: 'a2', distanceM: 10, shots: 10, manualScore: 100 }),
  ],
});
const SESSION_B = session({
  id: 'b',
  date: '2026-09-15',
  ammunitionId: 'sellier',
  rounds: [round({ id: 'b1', shots: 10, manualScore: 88, analysis: analysis(50, -14, 10) })],
});
const SESSION_C = session({
  id: 'c',
  date: '2026-07-01',
  configurationId: null,
  rounds: [round({ id: 'c1', shots: 20, manualScore: 170, analysis: analysis(60, -20, 20) })],
});
const SESSIONS = [SESSION_A, SESSION_B, SESSION_C];

const kpis = () => screen.findByRole('region', { name: 'Indicadores' });

describe('PerformanceScreen', () => {
  it('muestra los KPIs de los últimos 90 días a la distancia más usada, con su delta', async () => {
    renderSessions('/rendimiento', { sessions: SESSIONS });
    const region = await kpis();
    // (92 + 88) / 20 = 9 contra 170 / 20 = 8,5.
    expect(region).toHaveTextContent('Prom./tiro9▲ Subió 0,5 (mejor)');
    // (40 + 50) / 2 = 45 contra 60.
    expect(region).toHaveTextContent('Tamaño de grupo45,0mm▼ Bajó 15,0 mm (mejor)');
    // PMI de los 20 impactos: (0, -12).
    expect(region).toHaveTextContent('Desvío PMI12,0mmTendencia hacia las 6 h');
    // La ronda a 10 m no entra.
    expect(region).toHaveTextContent('Disparos202 sesiones · 2 rondas');
    expect(screen.getByRole('button', { name: /Distancia: 25 m/ })).toBeInTheDocument();
  });

  it('dibuja los gráficos por sesión con un resumen accesible', async () => {
    renderSessions('/rendimiento', { sessions: SESSIONS });
    expect(
      await screen.findByRole('img', {
        name: 'Puntaje promedio por tiro en 2 sesiones, del 15 sep al 20 oct: de 8,8 a 9,2',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Tamaño de grupo por sesión en mm en 2 sesiones, del 15 sep al 20 oct: de 50,0 a 40,0',
      }),
    ).toBeInTheDocument();
    // Mobile: comparación por munición, de mejor a peor.
    const byAmmunition = screen.getByRole('region', { name: 'Por munición' });
    const items = within(byAmmunition).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Magtech 9mm FMJ 115gr9,2 · 40,0 mm');
    expect(items[1]).toHaveTextContent('Sellier & Bellot 9mm FMJ 124gr8,8 · 50,0 mm');
  });

  it('en mobile, cada chip abre un sheet; elegir una opción filtra y queda en la URL', async () => {
    const { router } = renderSessions('/rendimiento', { sessions: SESSIONS });
    await userEvent.click(await screen.findByRole('button', { name: /Munición: Todas/ }));
    const sheet = screen.getByRole('dialog', { name: 'Munición' });
    expect(router.state.location.search).toBe('?filtro=ammunitionId');

    await userEvent.click(within(sheet).getByRole('button', { name: 'Magtech 9mm FMJ 115gr' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('?municion=magtech');
    expect(await kpis()).toHaveTextContent('Disparos101 sesión · 1 ronda');
    expect(screen.getByRole('button', { name: /Munición: Magtech/ })).toBeInTheDocument();
  });

  it('"atrás" cierra el sheet de un filtro sin cambiarlo', async () => {
    const { router } = renderSessions('/rendimiento', { sessions: SESSIONS });
    await userEvent.click(await screen.findByRole('button', { name: /Período: Últimos 90 días/ }));
    expect(screen.getByRole('dialog', { name: 'Período' })).toBeInTheDocument();
    await act(() => router.navigate(-1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('');
  });

  it('con pocos datos (menos de 2 sesiones) muestra solo los KPIs', async () => {
    renderSessions('/rendimiento?periodo=30d', { sessions: SESSIONS });
    expect(await kpis()).toHaveTextContent('Disparos101 sesión · 1 ronda');
    expect(screen.getByText(/Con dos sesiones o más/)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Puntaje promedio/ })).not.toBeInTheDocument();
  });

  it('sin análisis todavía invita a analizar los blancos', async () => {
    renderSessions('/rendimiento', {
      sessions: [session({ rounds: [round({ manualScore: 90 })] })],
    });
    expect(
      await screen.findByRole('heading', { name: 'Analizá tus blancos para ver la evolución' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a sesiones' })).toHaveAttribute(
      'href',
      '/sesiones',
    );
  });

  it('sin datos para los filtros, "Limpiar filtros" vuelve a los de por defecto', async () => {
    const { router } = renderSessions('/rendimiento?poligono=alamos', { sessions: SESSIONS });
    expect(
      await screen.findByRole('heading', { name: 'Sin datos para estos filtros' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(router.state.location.search).toBe('');
    expect(await kpis()).toBeInTheDocument();
  });

  describe('desktop', () => {
    beforeEach(() => setDesktop(true));

    it('filtra con selects; con "Todas" las distancias suma la ronda a 10 m', async () => {
      const { router } = renderSessions('/rendimiento', { sessions: SESSIONS });
      const distance = await screen.findByRole('combobox', { name: 'Distancia' });
      expect(distance).toHaveDisplayValue('La más usada (25 m)');

      await userEvent.selectOptions(distance, 'Todas');
      expect(router.state.location.search).toBe('?distancia=todas');
      expect(await kpis()).toHaveTextContent('Disparos302 sesiones · 3 rondas');
    });

    it('la tabla por sesión se ordena por columna y exporta CSV', async () => {
      const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:csv');
      URL.createObjectURL = createObjectURL;
      URL.revokeObjectURL = vi.fn();
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      renderSessions('/rendimiento', { sessions: SESSIONS });
      const table = await screen.findByRole('table', { name: 'Detalle por sesión' });
      const dates = () =>
        within(table)
          .getAllByRole('row')
          .slice(1)
          .map((row) => within(row).getAllByRole('cell')[0]!.textContent);
      expect(dates()).toEqual(['20/10/2026', '15/09/2026']);
      expect(within(table).getByRole('columnheader', { name: /Fecha/ })).toHaveAttribute(
        'aria-sort',
        'descending',
      );

      await userEvent.click(within(table).getByRole('button', { name: 'Grupo' }));
      expect(dates()).toEqual(['15/09/2026', '20/10/2026']);
      expect(within(table).getByRole('columnheader', { name: /Grupo/ })).toHaveAttribute(
        'aria-sort',
        'descending',
      );
      expect(within(table).getByRole('row', { name: /15\/09\/2026/ })).toHaveTextContent(
        '14,0 mm · 6 h',
      );

      await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
      expect(click).toHaveBeenCalled();
      const csv = await createObjectURL.mock.calls[0]![0].text();
      const lines = csv.replace(/^\uFEFF/, '').split('\r\n');
      expect(lines[0]).toMatch(/^Fecha;Configuración;Munición;Polígono;Distancia \(m\)/);
      expect(lines[1]).toBe(
        '15/09/2026;Glock 17 Gen5 · Config. IPSC;Sellier & Bellot 9mm FMJ 124gr;Polígono Norte;25;1;10;8,8;50,0;14,0;6',
      );
      click.mockRestore();
    });
  });
});
