import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOAST_DURATION_MS } from '@/hooks/use-toast';
import { parseMantisFile } from '@/lib/mantis-import';
import type { Session } from '@/lib/sessions';
import { ROUND_2, TODAY_SESSION } from '@/test/fake-sessions';
import { MANTIS_EXPORT } from '@/test/mantis-fixture';
import { setDesktop } from '@/test/match-media';
import { renderSessions } from '@/test/render-sessions';

const result = parseMantisFile(JSON.stringify(MANTIS_EXPORT));
if (!result.ok) throw new Error(result.error);
// Sesión 36042499: puntajes 93,52 · 91,31 · 88,09 · 82,68 · 85,85; splits 3,90 · 3,75 · 3,02 · 6,46.
const IMPORTED = result.file.sessions[2]!;
const PK = IMPORTED.summary.sessionPk;

const SESSION: Session = {
  ...TODAY_SESSION,
  rounds: [
    { ...ROUND_2, id: 'r1', distanceM: 5.5, shots: 5, createdAt: null, mantis: IMPORTED.summary },
    { ...ROUND_2, id: 'r2', createdAt: null, mantis: null },
  ],
};
const PATH = `/sesiones/${SESSION.id}/rondas/r1/mantisx`;

function render(path = PATH, traces = { [PK]: IMPORTED.trace }) {
  return renderSessions(path, { sessions: [SESSION], traces });
}

afterEach(() => {
  vi.useRealTimers();
  setDesktop(false);
});

describe('MantisRoundScreen', () => {
  it('muestra el resumen: puntaje promedio, tiempo total y split promedio', async () => {
    render();
    const summary = await screen.findByRole('region', { name: 'Resumen' });
    expect(summary).toHaveTextContent('Puntaje88,3Promedio');
    expect(summary).toHaveTextContent('Tiempo17,1sTotal');
    // Sin el primer disparo: (3,90 + 3,75 + 3,02 + 6,46) / 4.
    expect(summary).toHaveTextContent('Split4,28sPromedio');
    expect(screen.getByRole('heading', { level: 1, name: 'MantisX' })).toBeInTheDocument();
    expect(screen.getByText('X10 · Glock G17 · Zurdo · Open Training')).toBeInTheDocument();
  });

  it('lista los disparos con los extremos y muestra los datos del elegido', async () => {
    const user = userEvent.setup();
    render();
    const list = await screen.findByRole('region', { name: 'Disparos' });
    const rows = within(list).getAllByRole('button');
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveAttribute('aria-pressed', 'true');
    expect(rows[0]).toHaveAccessibleName(
      'Disparo 1: 93,5 puntos, primer disparo, Quebrar la muñeca hacia arriba',
    );
    expect(rows[0]).toHaveTextContent('Primer disparo');
    expect(rows[0]).toHaveTextContent('Mejor');
    expect(rows[3]).toHaveTextContent('Peor');
    expect(rows[3]).toHaveTextContent('Split más rápido');
    expect(rows[4]).toHaveTextContent('Split más lento');

    await user.click(rows[1]!);
    expect(rows[1]).toHaveAttribute('aria-pressed', 'true');
    const card = screen.getByRole('region', { name: 'Disparo 2 de 5' });
    expect(card).toHaveTextContent('Split3,90 s');
    expect(card).toHaveTextContent('DiagnósticoGolpear el gatillo');
    expect(card).toHaveTextContent('Dirección5 h');
    expect(card).toHaveTextContent('Inclinación arma1,0°');
    expect(card).toHaveTextContent('Mov. apuntando0,15');
    expect(card).toHaveTextContent('Mov. disparando0,08');

    await user.click(within(card).getByRole('button', { name: 'Disparo siguiente' }));
    expect(screen.getByRole('heading', { name: 'Disparo 3 de 5' })).toBeInTheDocument();
  });

  it('dibuja la trayectoria del disparo, en mm a la distancia de la ronda', async () => {
    render();
    const trace = await screen.findByRole('img', { name: /^Trayectoria del disparo 1/ });
    expect(trace).toHaveAccessibleName(/en mm a 5,5 m\. Círculos de .+ y .+ mm\.$/);
    expect(trace.querySelectorAll('path')).toHaveLength(4);
    expect(screen.getByRole('list', { name: 'Fases' })).toHaveTextContent(
      'ApuntadoPresión del gatilloSeguimientoDisparo',
    );
  });

  it('si la trayectoria no está, muestra el resto igual', async () => {
    render(PATH, {});
    expect(await screen.findByText('No se pudo cargar la trayectoria')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Resumen' })).toBeInTheDocument();
  });

  it('reproduce la trayectoria en el tiempo y se puede pausar y repetir', async () => {
    vi.useFakeTimers();
    // Con el reloj simulado, los clics van con `fireEvent` (sincrónicos).
    const click = (element: HTMLElement) => act(() => fireEvent.click(element));
    render();
    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(screen.getByRole('img', { name: /^Trayectoria del disparo 1/ })).toBeInTheDocument();

    await click(screen.getByRole('button', { name: 'Reproducir' }));
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeInTheDocument();
    // 15 muestras a 13,3 por segundo, en cámara lenta (1/10): unos 10,5 s en total.
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByText(/^−0,\d\d s$/)).toBeInTheDocument();

    await click(screen.getByRole('button', { name: 'Pausar' }));
    expect(screen.getByRole('button', { name: 'Reproducir' })).toBeInTheDocument();

    await click(screen.getByRole('radio', { name: 'Real' }));
    await click(screen.getByRole('button', { name: 'Reproducir' }));
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(screen.getByRole('button', { name: 'Repetir' })).toBeInTheDocument();
    // Al terminar ya no se muestra el tiempo.
    expect(screen.queryByText(/^[−+]\d,\d\d s$/)).toBeNull();

    // Cambiar de disparo detiene la reproducción y muestra la trayectoria completa.
    await click(screen.getByRole('button', { name: 'Repetir' }));
    await click(screen.getByRole('button', { name: 'Disparo siguiente' }));
    expect(screen.getByRole('button', { name: 'Reproducir' })).toBeInTheDocument();
  });

  it('quita los datos de MantisX con "Deshacer" y después borra la trayectoria', async () => {
    const user = userEvent.setup();
    const view = render();
    await user.click(await screen.findByRole('button', { name: 'Quitar los datos de MantisX' }));
    const dialog = screen.getByRole('alertdialog', { name: '¿Quitar los datos de MantisX?' });
    await user.click(within(dialog).getByRole('button', { name: 'Quitar' }));

    expect(await screen.findByText('Se quitaron los datos de MantisX')).toBeInTheDocument();
    expect(view.router.state.location.pathname).toBe(`/sesiones/${SESSION.id}`);
    expect(view.sessionItems()[0]!.rounds[0]!.mantis).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    await waitFor(() => expect(view.sessionItems()[0]!.rounds[0]!.mantis).not.toBeNull());
    expect(view.mantisTraces.remove).not.toHaveBeenCalled();
  });

  it('la trayectoria se borra cuando ya no se puede deshacer', async () => {
    vi.useFakeTimers();
    const click = (element: HTMLElement) => act(() => fireEvent.click(element));
    const view = render();
    await act(() => vi.advanceTimersByTimeAsync(10));
    await click(screen.getByRole('button', { name: 'Quitar los datos de MantisX' }));
    await click(screen.getByRole('button', { name: 'Quitar' }));
    await act(() => vi.advanceTimersByTimeAsync(TOAST_DURATION_MS + 2000));
    expect(view.mantisTraces.remove).toHaveBeenCalledWith('ana', PK);
  });

  it('sin datos de MantisX vuelve a la sesión', async () => {
    const view = render(`/sesiones/${SESSION.id}/rondas/r2/mantisx`);
    await waitFor(() =>
      expect(view.router.state.location.pathname).toBe(`/sesiones/${SESSION.id}`),
    );
  });
});

describe('MantisX en el detalle de la sesión', () => {
  it('desde el análisis de la ronda también se llega a MantisX', async () => {
    const user = userEvent.setup();
    const view = render(`/sesiones/${SESSION.id}/rondas/r1/analisis`);
    await user.click(
      await screen.findByRole('link', {
        name: 'Ver MantisX de la ronda 1: puntaje 88,3, tiempo 17,1 s',
      }),
    );
    expect(view.router.state.location.pathname).toBe(PATH);
  });

  it('el análisis de una ronda sin MantisX no muestra el acceso', async () => {
    render(`/sesiones/${SESSION.id}/rondas/r2/analisis`);
    await screen.findByRole('heading', { level: 1, name: /Análisis · Ronda 2/ });
    expect(screen.queryByRole('link', { name: /Ver MantisX/ })).toBeNull();
  });

  it('la ronda muestra su resumen de MantisX y lleva a su pantalla', async () => {
    const user = userEvent.setup();
    const view = render(`/sesiones/${SESSION.id}`);
    const link = await screen.findByRole('link', {
      name: 'Ver MantisX de la ronda 1: puntaje 88,3, tiempo 17,1 s',
    });
    expect(link).toHaveTextContent('MantisX 88,3 · 17,1 s');
    expect(screen.queryByRole('link', { name: /Ver MantisX de la ronda 2/ })).toBeNull();
    await user.click(link);
    expect(view.router.state.location.pathname).toBe(PATH);
  });

  it('en desktop, la tabla de rondas tiene la columna MantisX', async () => {
    setDesktop(true);
    render(`/sesiones/${SESSION.id}`);
    const table = await screen.findByRole('table', { name: 'Rondas' });
    expect(within(table).getByRole('columnheader', { name: 'MantisX' })).toBeInTheDocument();
    expect(
      within(table).getByRole('link', { name: /Ver MantisX de la ronda 1/ }),
    ).toHaveTextContent('88,3 · 17,1 s');
  });
});
