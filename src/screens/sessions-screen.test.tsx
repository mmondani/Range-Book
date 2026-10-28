import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SKELETON_DELAY_MS } from '@/components/skeleton';
import { ANA } from '@/test/fake-auth';
import { RUGER_SESSION, SEPTEMBER_SESSION, TODAY, TODAY_SESSION } from '@/test/fake-sessions';
import { setDesktop } from '@/test/match-media';
import { renderSessions } from '@/test/render-sessions';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

const cards = () => screen.getAllByRole('link', { name: /Glock|Ruger/ });

describe('SessionsScreen', () => {
  it('agrupa por mes, de la más reciente a la más vieja, y destaca la de hoy', async () => {
    renderSessions('/sesiones');
    const october = await screen.findByRole('region', { name: 'Octubre 2026' });
    const september = screen.getByRole('region', { name: 'Septiembre 2026' });

    const octoberCards = within(october).getAllByRole('link');
    expect(octoberCards).toHaveLength(2);
    expect(octoberCards[0]).toHaveTextContent('Glock 17 Gen5 · Config. IPSC');
    expect(octoberCards[0]).toHaveTextContent('Hoy');
    expect(octoberCards[0]).toHaveTextContent('Polígono Norte · Magtech 9mm FMJ 115gr');
    // 136 + 131 en 30 disparos = 8,9 por tiro.
    expect(octoberCards[0]).toHaveTextContent('2 rondas30 disparos8,9 prom.');
    expect(octoberCards[1]).toHaveTextContent('Ruger 10/22 · Stock');
    expect(octoberCards[1]).not.toHaveTextContent('Hoy');
    expect(within(octoberCards[1]!).getByRole('img', { name: 'Nublado' })).toBeInTheDocument();
    expect(within(september).getByRole('link')).toHaveTextContent('Glock 17 Gen5 · Stock');
  });

  it('muestra el resumen del mes: sesiones, disparos y promedio por tiro', async () => {
    renderSessions('/sesiones');
    const summary = await screen.findByRole('region', { name: 'Resumen del mes' });
    // Octubre: 2 sesiones, 40 disparos, (136 + 131 + 96) / 40.
    expect(summary).toHaveTextContent('Sesiones2');
    expect(summary).toHaveTextContent('Disparos40');
    expect(summary).toHaveTextContent('Prom./tiro9,1');
  });

  it('busca por arma, polígono o nota', async () => {
    const { router } = renderSessions('/sesiones');
    await userEvent.click(await screen.findByRole('button', { name: 'Buscar sesiones' }));
    const search = screen.getByRole('searchbox', { name: 'Buscar sesiones' });
    expect(search).toHaveFocus();

    await userEvent.type(search, 'alamos');
    expect(cards()).toHaveLength(1);
    expect(cards()[0]).toHaveTextContent('Ruger 10/22');
    expect(router.state.location.search).toBe('?q=alamos');

    await userEvent.clear(search);
    await userEvent.type(search, 'lluvia');
    expect(cards()).toHaveLength(1);
    expect(cards()[0]).toHaveTextContent('Glock 17 Gen5 · Stock');
  });

  it('filtra por arma y muestra "Sin resultados" con la opción de limpiar', async () => {
    renderSessions('/sesiones?q=lluvia');
    await userEvent.click(await screen.findByRole('button', { name: 'Filtrar sesiones' }));
    const filter = screen.getByRole('group', { name: 'Filtrar por arma' });
    // Solo las armas que tienen sesiones.
    expect(
      within(filter)
        .getAllByRole('button')
        .map((chip) => chip.textContent),
    ).toEqual(['Todas', 'Glock 17 Gen5', 'Ruger 10/22']);

    await userEvent.click(within(filter).getByRole('button', { name: 'Ruger 10/22' }));
    expect(screen.getByRole('heading', { name: 'Sin resultados' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(cards()).toHaveLength(3);
  });

  it('conserva la búsqueda y el filtro al volver del detalle', async () => {
    const { router } = renderSessions('/sesiones?arma=ruger');
    await userEvent.click(await screen.findByRole('link', { name: /Ruger 10\/22/ }));
    expect(router.state.location.pathname).toBe('/sesiones/ruger-oct');
    await userEvent.click(await screen.findByRole('link', { name: 'Volver a sesiones' }));
    expect(router.state.location.search).toBe('?arma=ruger');
    expect(await screen.findByRole('group', { name: 'Filtrar por arma' })).toBeInTheDocument();
    expect(cards()).toHaveLength(1);
  });

  it('estado vacío con "Nueva sesión"', async () => {
    renderSessions('/sesiones', { sessions: [] });
    expect(
      await screen.findByRole('heading', { name: 'Todavía no registraste sesiones' }),
    ).toBeInTheDocument();
    // El del sidebar está siempre (se oculta con CSS en mobile).
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: 'Nueva sesión' }),
    ).toHaveAttribute('href', '/sesiones/nueva');
    expect(screen.queryByRole('region', { name: 'Resumen del mes' })).not.toBeInTheDocument();
  });

  it('muestra skeletons mientras carga', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
    renderSessions('/sesiones', {
      repository: {
        subscribe: () => () => {},
        newId: () => 'x',
        create: async () => {},
        update: async () => {},
        remove: async () => ({ undo: async () => {} }),
        saveRound: async () => {},
        saveAnalysis: async () => {},
        removeRound: async () => ({ undo: async () => {} }),
      },
    });
    // Primero se resuelve la sesión de Firebase.
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByLabelText('Cargando sesiones')).toHaveAttribute('aria-busy', 'true');
    await act(() => vi.advanceTimersByTimeAsync(SKELETON_DELAY_MS));
    expect(screen.getAllByTestId('skeleton')).toHaveLength(3);
  });

  it('el FAB "Nueva sesión" abre el formulario', async () => {
    const { router } = renderSessions('/sesiones');
    await screen.findByRole('region', { name: 'Octubre 2026' });
    await userEvent.click(
      within(screen.getByRole('main')).getByRole('link', { name: 'Nueva sesión' }),
    );
    expect(router.state.location.pathname).toBe('/sesiones/nueva');
  });

  describe('desktop', () => {
    beforeEach(() => setDesktop(true));

    it('muestra la lista y el detalle de la sesión elegida a la vez', async () => {
      renderSessions('/sesiones');
      expect(await screen.findByRole('heading', { name: 'Elegí una sesión' })).toBeInTheDocument();
      expect(screen.getByText('3 en total')).toBeInTheDocument();
      // Búsqueda y chips visibles sin abrirlos.
      expect(screen.getByRole('searchbox', { name: 'Buscar sesiones' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Filtrar por arma' })).toBeInTheDocument();

      await userEvent.click(screen.getByRole('link', { name: /Ruger 10\/22/ }));
      const detail = screen.getByRole('region', { name: 'Detalle de la sesión' });
      expect(
        await within(detail).findByRole('heading', { level: 2, name: 'Ruger 10/22 · Stock' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Ruger 10\/22/ })).toHaveAttribute(
        'aria-current',
        'true',
      );
      expect(screen.getByRole('heading', { level: 1, name: 'Sesiones' })).toBeInTheDocument();
    });
  });
});

describe('SessionDetail', () => {
  it('muestra fecha, configuración, personalizaciones, datos, totales y notas', async () => {
    renderSessions('/sesiones/hoy');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Glock 17 Gen5 · Config. IPSC' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Mié 28 oct 2026')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Personalizaciones' })).toHaveTextContent(
      'Holosun 507C X2Zev PRO Trigger',
    );
    expect(screen.getByText('Polígono Norte')).toBeInTheDocument();
    expect(screen.getByText('Soleado')).toBeInTheDocument();
    expect(screen.getByText('Magtech 9mm FMJ 115gr')).toBeInTheDocument();

    const totals = screen.getByRole('region', { name: 'Totales' });
    expect(totals).toHaveTextContent('Disparos30');
    // 136 + 131 sobre 30 disparos × 10 (zona más alta del ISSF).
    expect(totals).toHaveTextContent('Puntaje267 / 300');
    expect(totals).toHaveTextContent('Grupo46,0 mm');

    expect(screen.getByRole('heading', { name: 'Rondas · 2' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Fotos del polígono' }).children).toHaveLength(2);
    expect(screen.getByText('Práctica de dobles a 7 m.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Editar sesión' })).toHaveAttribute(
      'href',
      '/sesiones/hoy/editar',
    );
  });

  it('una sesión sin rondas ni puntaje', async () => {
    renderSessions(`/sesiones/${SEPTEMBER_SESSION.id}`);
    expect(
      await screen.findByRole('heading', { name: 'Todavía no hay rondas' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Totales' })).toHaveTextContent(
      'Disparos0Puntaje—Grupo—',
    );
  });

  it('una sesión que no existe vuelve a la lista', async () => {
    const { router } = renderSessions('/sesiones/nada');
    await screen.findByRole('region', { name: 'Octubre 2026' });
    expect(router.state.location.pathname).toBe('/sesiones');
  });

  it('eliminar pide confirmación y ofrece "Deshacer"', async () => {
    const { router, sessions, sessionItems } = renderSessions(`/sesiones/${RUGER_SESSION.id}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar sesión' }));
    const dialog = screen.getByRole('alertdialog', { name: '¿Eliminar la sesión?' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(sessions.remove).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar sesión' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar' }),
    );
    expect(sessions.remove).toHaveBeenCalledWith(ANA.uid, RUGER_SESSION.id);
    await waitFor(() => expect(router.state.location.pathname).toBe('/sesiones'));
    expect(await screen.findByText('Sesión eliminada')).toBeInTheDocument();
    expect(sessionItems().map((item) => item.id)).not.toContain(RUGER_SESSION.id);
    expect(screen.queryByRole('link', { name: /Ruger 10\/22/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(await screen.findByText('Sesión restaurada')).toBeInTheDocument();
    expect(sessionItems().map((item) => item.id)).toContain(RUGER_SESSION.id);
    expect(await screen.findByRole('link', { name: /Ruger 10\/22/ })).toBeInTheDocument();
  });

  it('las fotos se borran recién cuando ya no se puede deshacer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(TODAY);
    const { photos } = renderSessions(`/sesiones/${TODAY_SESSION.id}`);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole('button', { name: 'Eliminar sesión' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar' }),
    );
    await screen.findByText('Sesión eliminada');
    expect(photos.remove).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(vi.mocked(photos.remove).mock.calls.map(([path]) => path)).toEqual([
      ...TODAY_SESSION.photos,
      'users/ana/rounds/r1/a.jpg',
    ]);
  });
});
