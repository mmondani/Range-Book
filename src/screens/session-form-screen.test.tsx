import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { draftStorageKey } from '@/lib/sessions';
import { ANA } from '@/test/fake-auth';
import { TODAY, TODAY_SESSION } from '@/test/fake-sessions';
import { renderSessions } from '@/test/render-sessions';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

const NEW_DRAFT_KEY = draftStorageKey(ANA.uid);

const heading = (name = 'Nueva sesión') => screen.findByRole('heading', { level: 1, name });
const select = (name: RegExp) => screen.getByRole('combobox', { name });
const firearm = () => select(/Arma \/ configuración/);
const save = () => userEvent.click(screen.getByRole('button', { name: 'Guardar sesión' }));
const modifications = () => screen.getByRole('group', { name: 'Personalizaciones' });

describe('SessionFormScreen · nueva', () => {
  it('precarga hoy y el último polígono; la munición, la última usada con el arma', async () => {
    renderSessions('/sesiones/nueva');
    await heading();
    expect(screen.getByLabelText(/Fecha/)).toHaveValue('2026-10-28');
    expect(select(/Polígono/)).toHaveDisplayValue('Polígono Norte');
    expect(firearm()).toHaveValue('');
    expect(select(/Munición/)).toHaveValue('');

    await userEvent.selectOptions(firearm(), 'Ruger 10/22 · Stock');
    expect(select(/Munición/)).toHaveDisplayValue('CCI Standard Velocity');
    await userEvent.selectOptions(firearm(), 'Glock 17 Gen5 · Config. IPSC');
    expect(select(/Munición/)).toHaveDisplayValue('Magtech 9mm FMJ 115gr');
  });

  it('ofrece solo armas, configuraciones, polígonos y munición activos', async () => {
    renderSessions('/sesiones/nueva');
    await heading();
    const options = within(firearm())
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual([
      'Elegí el arma',
      'Glock 17 Gen5 · Stock',
      'Glock 17 Gen5 · Config. IPSC',
      'Ruger 10/22 · Stock',
    ]);
    expect(
      within(select(/Munición/))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).not.toContain('Sellier & Bellot 9mm FMJ 124gr');
  });

  it('la configuración precarga sus personalizaciones; se pueden quitar y agregar', async () => {
    renderSessions('/sesiones/nueva');
    await heading();
    expect(screen.getByText('Elegí primero el arma.')).toBeInTheDocument();

    await userEvent.selectOptions(firearm(), 'Glock 17 Gen5 · Config. IPSC');
    expect(modifications()).toHaveTextContent('Holosun 507C X2Zev PRO Trigger');

    await userEvent.click(screen.getByRole('button', { name: 'Quitar Holosun 507C X2' }));
    expect(modifications()).not.toHaveTextContent('Holosun');
    await userEvent.click(within(modifications()).getByRole('button', { name: 'Agregar' }));
    // Solo las activas que faltan (Taran está archivada).
    const options = screen.getByRole('group', { name: 'Modificaciones para agregar' });
    expect(within(options).getAllByRole('button')).toHaveLength(1);
    await userEvent.click(within(options).getByRole('button', { name: 'Agregar Holosun 507C X2' }));
    expect(modifications()).toHaveTextContent('Zev PRO TriggerHolosun 507C X2');
    // Ya no queda nada para agregar.
    expect(within(modifications()).queryByRole('button', { name: 'Agregar' })).toBeNull();

    // "Stock" no tiene personalizaciones.
    await userEvent.selectOptions(firearm(), 'Glock 17 Gen5 · Stock');
    expect(within(modifications()).queryByRole('button', { name: /Quitar/ })).toBeNull();
  });

  it('valida al salir del campo', async () => {
    renderSessions('/sesiones/nueva');
    await heading();
    await userEvent.click(firearm());
    expect(screen.queryByText('Elegí el arma o una configuración')).not.toBeInTheDocument();
    await userEvent.tab();
    expect(screen.getByText('Elegí el arma o una configuración')).toBeInTheDocument();
    expect(firearm()).toHaveAttribute('aria-invalid', 'true');

    await userEvent.selectOptions(firearm(), 'Glock 17 Gen5 · Stock');
    expect(screen.queryByText('Elegí el arma o una configuración')).not.toBeInTheDocument();

    const date = screen.getByLabelText(/Fecha/);
    await userEvent.clear(date);
    await userEvent.type(date, '2026-11-02');
    await userEvent.tab();
    expect(screen.getByText('La fecha no puede ser futura')).toBeInTheDocument();
  });

  it('al guardar con errores, el foco va al primer campo inválido', async () => {
    const { sessions } = renderSessions('/sesiones/nueva');
    await heading();
    await save();
    expect(firearm()).toHaveFocus();
    expect(screen.getAllByRole('alert').map((alert) => alert.textContent)).toEqual([
      'Elegí el arma o una configuración',
      'Elegí la munición',
    ]);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('guarda la sesión con la copia de las personalizaciones y abre su detalle', async () => {
    const { sessions, router } = renderSessions('/sesiones/nueva');
    await heading();
    await userEvent.selectOptions(firearm(), 'Glock 17 Gen5 · Config. IPSC');
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Zev PRO Trigger' }));
    await userEvent.selectOptions(select(/Polígono/), 'Club de Tiro Los Álamos');
    await userEvent.click(screen.getByRole('radio', { name: 'Ventoso' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Notas' }), '  Viento cruzado  ');
    await save();

    expect(sessions.create).toHaveBeenCalledWith(ANA.uid, 'session-1', {
      date: '2026-10-28',
      firearmId: 'glock',
      configurationId: 'ipsc',
      modificationsSnapshot: [{ brand: 'Holosun', model: '507C X2' }],
      rangeId: 'alamos',
      weather: 'windy',
      ammunitionId: 'magtech',
      photos: [],
      notes: 'Viento cruzado',
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/sesiones/session-1'));
    expect(await screen.findByText('Sesión creada')).toBeInTheDocument();
    expect(localStorage.getItem(NEW_DRAFT_KEY)).toBeNull();
  });

  it('el clima es opcional y se puede desmarcar', async () => {
    renderSessions('/sesiones/nueva');
    await heading();
    const sunny = screen.getByRole('radio', { name: 'Soleado' });
    await userEvent.click(sunny);
    expect(sunny).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(sunny);
    expect(sunny).toHaveAttribute('aria-checked', 'false');
  });

  it('cerrar con cambios pide confirmación', async () => {
    const { router } = renderSessions('/sesiones/nueva');
    await heading();
    await userEvent.type(screen.getByRole('textbox', { name: 'Notas' }), 'Algo');

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sin guardar' }));
    const dialog = screen.getByRole('alertdialog', { name: '¿Descartar los cambios?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Seguir editando' }));
    expect(router.state.location.pathname).toBe('/sesiones/nueva');
    expect(screen.getByRole('textbox', { name: 'Notas' })).toHaveValue('Algo');

    // También al ir a otra sección.
    await userEvent.click(screen.getAllByRole('link', { name: 'Inventario' })[0]!);
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Descartar' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/inventario/armas'));
    expect(localStorage.getItem(NEW_DRAFT_KEY)).toBeNull();
  });

  it('sin cambios, cerrar no pide confirmación', async () => {
    const { router } = renderSessions('/sesiones/nueva');
    await heading();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sin guardar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/sesiones'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('guarda un borrador local y lo recupera al volver', async () => {
    const first = renderSessions('/sesiones/nueva');
    await heading();
    await userEvent.selectOptions(firearm(), 'Glock 17 Gen5 · Config. IPSC');
    await userEvent.type(screen.getByRole('textbox', { name: 'Notas' }), 'Sin terminar');
    expect(JSON.parse(localStorage.getItem(NEW_DRAFT_KEY)!)).toMatchObject({
      firearm: 'glock/ipsc',
      notes: 'Sin terminar',
    });
    // Se cierra la app sin guardar.
    first.unmount();

    renderSessions('/sesiones/nueva');
    await heading();
    expect(screen.getByText('Recuperamos los cambios que no guardaste')).toBeInTheDocument();
    expect(firearm()).toHaveValue('glock/ipsc');
    expect(screen.getByRole('textbox', { name: 'Notas' })).toHaveValue('Sin terminar');
    expect(modifications()).toHaveTextContent('Holosun 507C X2Zev PRO Trigger');

    await userEvent.click(screen.getByRole('button', { name: 'Descartar borrador' }));
    expect(screen.getByRole('textbox', { name: 'Notas' })).toHaveValue('');
    expect(firearm()).toHaveValue('');
    expect(localStorage.getItem(NEW_DRAFT_KEY)).toBeNull();
  });
});

describe('SessionFormScreen · editar', () => {
  it('precarga la sesión, conserva la copia de las personalizaciones y guarda los cambios', async () => {
    const { sessions, router, photos } = renderSessions('/sesiones/hoy/editar');
    await heading('Editar sesión');
    expect(firearm()).toHaveValue('glock/ipsc');
    expect(select(/Polígono/)).toHaveValue('norte');
    expect(select(/Munición/)).toHaveValue('magtech');
    expect(screen.getByRole('radio', { name: 'Soleado' })).toHaveAttribute('aria-checked', 'true');
    expect(modifications()).toHaveTextContent('Holosun 507C X2Zev PRO Trigger');
    // Las que ya están en la copia no se vuelven a ofrecer.
    expect(within(modifications()).queryByRole('button', { name: 'Agregar' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Quitar foto 2' }));
    await userEvent.clear(screen.getByRole('textbox', { name: 'Notas' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Notas' }), 'Corregido');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(sessions.update).toHaveBeenCalledWith(ANA.uid, 'hoy', {
      date: TODAY_SESSION.date,
      firearmId: 'glock',
      configurationId: 'ipsc',
      modificationsSnapshot: TODAY_SESSION.modificationsSnapshot,
      rangeId: 'norte',
      weather: 'sunny',
      ammunitionId: 'magtech',
      photos: [TODAY_SESSION.photos[0]],
      notes: 'Corregido',
    });
    // La foto quitada se borra después de guardar.
    expect(photos.remove).toHaveBeenCalledWith(TODAY_SESSION.photos[1]);
    await waitFor(() => expect(router.state.location.pathname).toBe('/sesiones/hoy'));
    expect(await screen.findByText('Cambios guardados')).toBeInTheDocument();
  });

  it('una sesión que no existe vuelve a la lista', async () => {
    const { router } = renderSessions('/sesiones/nada/editar');
    await waitFor(() => expect(router.state.location.pathname).toBe('/sesiones'));
  });
});
