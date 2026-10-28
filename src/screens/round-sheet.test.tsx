import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANA } from '@/test/fake-auth';
import { ROUND_1, TODAY, TODAY_SESSION } from '@/test/fake-sessions';
import { setDesktop } from '@/test/match-media';
import { renderSessions } from '@/test/render-sessions';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

const DETAIL = `/sesiones/${TODAY_SESSION.id}`;
const sheet = (name: string | RegExp) => screen.findByRole('dialog', { name });
const rounds = () => within(screen.getByRole('list', { name: 'Rondas' }));

async function openNewRound() {
  const view = renderSessions(DETAIL);
  await userEvent.click(await screen.findByRole('link', { name: 'Agregar ronda' }));
  return { ...view, dialog: await sheet('Nueva ronda · 3') };
}

describe('Rondas en el detalle de la sesión', () => {
  it('cada ronda muestra sus datos y si está analizada', async () => {
    renderSessions(DETAIL);
    await screen.findByRole('heading', { name: 'Rondas · 2' });
    const [first, second] = rounds().getAllByRole('listitem');
    expect(first).toHaveTextContent('Ronda 1Analizada15 disparos · 136 pts · 46,0 mm');
    expect(first).toHaveTextContent('ISSF Pistola Precisión · 25 m · Buen control del gatillo');
    expect(second).toHaveTextContent('Ronda 2Sin analizar15 disparos · 131 pts');
    expect(within(first!).getByRole('link', { name: 'Editar ronda 1' })).toHaveAttribute(
      'href',
      '/sesiones/hoy/rondas/r1/editar',
    );
  });

  it('en desktop es una tabla, con "Agregar ronda" en el encabezado', async () => {
    setDesktop(true);
    renderSessions(DETAIL);
    const table = await screen.findByRole('table', { name: 'Rondas' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('1 · ISSF Pistola Precisión25 m1513646,0 mm');
    expect(rows[2]).toHaveTextContent('Sin analizar');
    expect(screen.getByRole('link', { name: 'Agregar ronda' })).toHaveAttribute(
      'href',
      '/sesiones/hoy/rondas/nueva',
    );
  });
});

describe('M05 · Agregar ronda', () => {
  it('precarga el blanco, la distancia y los disparos de la ronda anterior', async () => {
    const { dialog } = await openNewRound();
    const sheetView = within(dialog);
    expect(sheetView.getByRole('combobox', { name: /^Blanco/ })).toHaveDisplayValue(
      'ISSF Pistola Precisión',
    );
    expect(sheetView.getByRole('textbox', { name: /^Distancia/ })).toHaveValue('25');
    expect(sheetView.getByRole('group', { name: /^Disparos/ })).toHaveTextContent('15');
    expect(sheetView.getByRole('textbox', { name: 'Puntaje' })).toHaveValue('');
    // El blanco archivado no se ofrece.
    expect(sheetView.queryByRole('option', { name: /NRA B-8/ })).not.toBeInTheDocument();
  });

  it('guarda la ronda al final de la sesión y vuelve al detalle', async () => {
    const { dialog, router, sessions } = await openNewRound();
    const sheetView = within(dialog);
    await userEvent.click(sheetView.getByRole('button', { name: 'Restar un disparo' }));
    await userEvent.type(sheetView.getByRole('textbox', { name: 'Puntaje' }), '128');
    await userEvent.type(sheetView.getByRole('textbox', { name: 'Comentarios' }), ' Viento ');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ronda' }));

    expect(sessions.saveRound).toHaveBeenCalledWith(
      ANA.uid,
      TODAY_SESSION.id,
      expect.any(String),
      {
        targetId: 'issf',
        distanceM: 25,
        shots: 14,
        manualScore: 128,
        photo: null,
        comments: 'Viento',
      },
      true,
    );
    expect(await screen.findByText('Ronda agregada')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe(DETAIL));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rondas · 3' })).toBeInTheDocument();
    expect(rounds().getAllByRole('listitem')[2]).toHaveTextContent(
      'Ronda 3Sin analizar14 disparos · 128 pts',
    );
  });

  it('"atrás" cierra el sheet y vuelve al detalle', async () => {
    const { router } = await openNewRound();
    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe(DETAIL);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rondas · 2' })).toBeInTheDocument();
  });

  it('valida al guardar y lleva el foco al primer error', async () => {
    const { dialog, sessions } = await openNewRound();
    const sheetView = within(dialog);
    const distance = sheetView.getByRole('textbox', { name: /^Distancia/ });
    await userEvent.clear(distance);
    await userEvent.type(sheetView.getByRole('textbox', { name: 'Puntaje' }), '151');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ronda' }));

    expect(sessions.saveRound).not.toHaveBeenCalled();
    expect(distance).toHaveFocus();
    expect(distance).toHaveAccessibleDescription('Ingresá la distancia');
    expect(sheetView.getByRole('textbox', { name: 'Puntaje' })).toHaveAccessibleDescription(
      'Máximo: 150. El puntaje no puede superar el máximo (150)',
    );
  });

  it('cerrar con cambios pide confirmación', async () => {
    const { dialog } = await openNewRound();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Puntaje' }), '120');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });

  it('una ronda que no existe vuelve al detalle', async () => {
    const { router } = renderSessions(`${DETAIL}/rondas/nada/editar`);
    await screen.findByRole('heading', { name: 'Rondas · 2' });
    expect(router.state.location.pathname).toBe(DETAIL);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('M05 · Editar ronda', () => {
  async function openRound(number: number) {
    const view = renderSessions(DETAIL);
    await userEvent.click(await screen.findByRole('link', { name: `Editar ronda ${number}` }));
    return { ...view, dialog: await sheet(`Editar ronda · ${number}`) };
  }

  it('carga los valores guardados y conserva el análisis si no cambia la foto', async () => {
    const { dialog, sessions } = await openRound(2);
    const sheetView = within(dialog);
    expect(sheetView.getByRole('textbox', { name: 'Puntaje' })).toHaveValue('131');
    await userEvent.type(sheetView.getByRole('textbox', { name: 'Comentarios' }), 'Tirones');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(sessions.saveRound).toHaveBeenCalledWith(
      ANA.uid,
      TODAY_SESSION.id,
      'r2',
      expect.objectContaining({ manualScore: 131, comments: 'Tirones' }),
      true,
    );
    expect(await screen.findByText('Cambios guardados')).toBeInTheDocument();
  });

  it('quitar la foto de una ronda analizada descarta el análisis y borra la foto', async () => {
    const { dialog, sessions, sessionItems, photos } = await openRound(1);
    const sheetView = within(dialog);
    await userEvent.click(sheetView.getByRole('button', { name: 'Quitar foto 1' }));
    expect(
      sheetView.getByText(
        'Cambiaste la foto o el blanco: al guardar se descarta el análisis de esta ronda.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(sessions.saveRound).toHaveBeenCalledWith(
      ANA.uid,
      TODAY_SESSION.id,
      ROUND_1.id,
      expect.objectContaining({ photo: null }),
      false,
    );
    await screen.findByText('Cambios guardados');
    expect(photos.remove).toHaveBeenCalledWith(ROUND_1.photo);
    const saved = sessionItems().find((item) => item.id === TODAY_SESSION.id)?.rounds[0];
    expect(saved).toMatchObject({ analysis: null, score: null, manualScore: 136 });
    expect(rounds().getAllByRole('listitem')[0]).toHaveTextContent('Ronda 1Sin analizar');
  });

  it('eliminar pide confirmación y ofrece "Deshacer"', async () => {
    const { dialog, router, sessions } = await openRound(1);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar ronda' }));
    const confirm = screen.getByRole('alertdialog', { name: '¿Eliminar la ronda 1?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Eliminar' }));

    expect(sessions.removeRound).toHaveBeenCalledWith(ANA.uid, TODAY_SESSION.id, ROUND_1.id);
    expect(await screen.findByText('Ronda eliminada')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe(DETAIL));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rondas · 1' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(await screen.findByText('Ronda restaurada')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rondas · 2' })).toBeInTheDocument();
    expect(rounds().getAllByRole('listitem')[0]).toHaveTextContent('Ronda 1Analizada');
  });
});
