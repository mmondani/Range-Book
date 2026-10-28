import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '@/components/auth-provider';
import { InventoryProvider } from '@/components/inventory-provider';
import { PhotoProvider } from '@/components/photo-provider';
import { ToastProvider } from '@/components/toast-provider';
import { routes } from '@/routes';
import { ANA, createFakeAuth } from '@/test/fake-auth';
import { createFakeInventory, GLOCK, IPSC } from '@/test/fake-inventory';
import { createFakePhotos } from '@/test/fake-photos';

type InventoryOptions = Parameters<typeof createFakeInventory>[0];

function renderFirearm(path = '/inventario/armas/glock', options?: InventoryOptions) {
  const { auth, profiles } = createFakeAuth({ initialUser: ANA });
  const inventory = createFakeInventory(options);
  const photos = createFakePhotos();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AuthProvider auth={auth} profiles={profiles}>
      <PhotoProvider repository={photos.repository}>
        <InventoryProvider repositories={inventory.repositories}>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </InventoryProvider>
      </PhotoProvider>
    </AuthProvider>,
  );
  return { ...inventory, photos: photos.repository, router };
}

const dialog = () => screen.findByRole('dialog');
const heading = () => screen.findByRole('heading', { level: 1, name: '17 Gen5' });
const field = (sheet: HTMLElement, name: RegExp | string) =>
  within(sheet).getByRole('textbox', { name });

describe('FirearmScreen', () => {
  it('muestra marca, modelo, calibre, tiros acumulados y datos de compra', async () => {
    renderFirearm();
    await heading();
    expect(screen.getByText('Glock')).toBeInTheDocument();
    expect(screen.getByText('9×19 mm')).toBeInTheDocument();
    // 1.200 previos + 100 + 50 + 60 de las sesiones de la Glock.
    expect(screen.getByText('1.410')).toBeInTheDocument();
    expect(screen.getByText('1.200 previos + 210 en 3 sesiones')).toBeInTheDocument();
    expect(screen.getByText('14/03/2023')).toBeInTheDocument();
    expect(screen.getByText('Armería Centro')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Fotos de Glock 17 Gen5' })).toBeInTheDocument();
  });

  it('lista las modificaciones activas; las archivadas con "Mostrar modificaciones archivadas"', async () => {
    renderFirearm();
    const region = await screen.findByRole('region', { name: 'Modificaciones' });
    expect(await within(region).findByText('Holosun 507C X2')).toBeInTheDocument();
    expect(within(region).getByText('Zev PRO Trigger')).toBeInTheDocument();
    expect(within(region).queryByText(/Taran/)).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Mostrar modificaciones archivadas (1)' }),
    );
    expect(within(region).getByText('Taran Tactical Base +2')).toBeInTheDocument();
    expect(
      within(region).getByRole('button', { name: 'Restaurar Taran Tactical Base +2' }),
    ).toBeInTheDocument();
  });

  it('"Stock" es implícita y cada configuración muestra sus sesiones y modificaciones', async () => {
    renderFirearm();
    const list = await screen.findByRole('list', { name: 'Configuraciones' });
    const cards = within(list).getAllByRole('listitem', { name: undefined });
    const top = cards.filter((card) => card.parentElement === list);
    expect(top).toHaveLength(2);
    expect(top[0]).toHaveTextContent('Stock');
    expect(top[0]).toHaveTextContent('2 sesiones');
    expect(top[0]).toHaveTextContent('Sin modificaciones');
    expect(top[1]).toHaveTextContent('Config. IPSC');
    expect(top[1]).toHaveTextContent('1 sesión');
    expect(
      await within(top[1]!).findByRole('list', { name: 'Modificaciones de Config. IPSC' }),
    ).toHaveTextContent('Holosun 507C X2Zev PRO Trigger');
    // "Stock" no se edita.
    expect(within(list).getAllByRole('button', { name: /Editar/ })).toHaveLength(1);
  });

  it('un arma que no existe vuelve a la lista', async () => {
    const { router } = renderFirearm('/inventario/armas/nada');
    await screen.findByRole('tab', { name: /Armas/, selected: true });
    expect(router.state.location.pathname).toBe('/inventario/armas');
  });

  it('archivar el arma la marca y permite restaurarla', async () => {
    const { repositories } = renderFirearm();
    await heading();
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    expect(repositories.firearms.setArchived).toHaveBeenCalledWith(ANA.uid, GLOCK.id, true);
    expect(await screen.findByText('Arma archivada')).toBeInTheDocument();
    expect(screen.getAllByText('Archivada').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Restaurar' }));
    expect(repositories.firearms.setArchived).toHaveBeenLastCalledWith(ANA.uid, GLOCK.id, false);
    expect(await screen.findByRole('button', { name: 'Archivar' })).toBeInTheDocument();
  });

  describe('modificaciones', () => {
    it('alta en sheet: valida y guarda en el arma', async () => {
      const { router, repositories, modifications } = renderFirearm();
      await userEvent.click(await screen.findByRole('link', { name: 'Agregar modificación' }));
      expect(router.state.location.pathname).toBe('/inventario/armas/glock/modificaciones/nueva');
      const sheet = await dialog();
      await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar modificación' }));
      expect(within(sheet).getByText('Ingresá la marca')).toBeInTheDocument();
      expect(field(sheet, /Marca/)).toHaveFocus();

      await userEvent.type(field(sheet, /Marca/), 'Streamlight');
      await userEvent.type(field(sheet, /Modelo/), 'TLR-7');
      await userEvent.type(field(sheet, 'Comentarios'), 'Linterna');
      await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar modificación' }));

      expect(repositories.modifications('glock').create).toHaveBeenCalledWith(ANA.uid, {
        brand: 'Streamlight',
        model: 'TLR-7',
        comments: 'Linterna',
      });
      expect(modifications('glock').map((item) => item.brand)).toContain('Streamlight');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(router.state.location.pathname).toBe('/inventario/armas/glock');
      expect(await screen.findByText('Streamlight TLR-7')).toBeInTheDocument();
    });

    it('archivar desde la edición', async () => {
      const { repositories } = renderFirearm();
      await userEvent.click(await screen.findByRole('button', { name: 'Editar Zev PRO Trigger' }));
      await userEvent.click(
        within(await dialog()).getByRole('button', { name: 'Archivar modificación' }),
      );
      expect(repositories.modifications('glock').setArchived).toHaveBeenCalledWith(
        ANA.uid,
        'zev',
        true,
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      const region = screen.getByRole('region', { name: 'Modificaciones' });
      expect(within(region).queryByText('Zev PRO Trigger')).not.toBeInTheDocument();
    });
  });

  describe('configuraciones', () => {
    it('alta: nombre y checkboxes de las modificaciones activas del arma', async () => {
      const { repositories } = renderFirearm();
      await userEvent.click(await screen.findByRole('link', { name: 'Nueva configuración' }));
      const sheet = await dialog();
      expect(within(sheet).queryByRole('combobox')).not.toBeInTheDocument();
      expect(await within(sheet).findAllByRole('checkbox')).toHaveLength(2);

      await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar configuración' }));
      expect(within(sheet).getByText('Ingresá el nombre')).toBeInTheDocument();
      expect(within(sheet).getByText('Elegí al menos una modificación')).toBeInTheDocument();

      await userEvent.type(field(sheet, /Nombre/), 'config. ipsc');
      await userEvent.click(within(sheet).getByRole('checkbox', { name: /Zev/ }));
      await userEvent.click(within(sheet).getByRole('checkbox', { name: /Holosun/ }));
      await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar configuración' }));
      expect(
        within(sheet).getByText('Ya hay una configuración con ese nombre para esta arma'),
      ).toBeInTheDocument();

      await userEvent.clear(field(sheet, /Nombre/));
      await userEvent.type(field(sheet, /Nombre/), 'Competencia');
      await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar configuración' }));
      expect(repositories.configurations.create).toHaveBeenCalledWith(ANA.uid, {
        name: 'Competencia',
        firearmId: GLOCK.id,
        modificationIds: ['zev', 'holosun'],
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(
        within(screen.getByRole('list', { name: 'Configuraciones' })).getByText('Competencia'),
      ).toBeInTheDocument();
    });

    it('la edición se abre por URL y archivar la saca de la lista', async () => {
      const { repositories } = renderFirearm('/inventario/armas/glock/configuraciones/ipsc/editar');
      const sheet = await dialog();
      expect(field(sheet, /Nombre/)).toHaveValue('Config. IPSC');
      await userEvent.click(within(sheet).getByRole('button', { name: 'Archivar configuración' }));
      expect(repositories.configurations.setArchived).toHaveBeenCalledWith(ANA.uid, IPSC.id, true);
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(
        within(screen.getByRole('list', { name: 'Configuraciones' })).queryByText('Config. IPSC'),
      ).not.toBeInTheDocument();
    });
  });

  describe('formulario de arma', () => {
    it('alta: valida los obligatorios y los tiros previos, guarda y abre el detalle', async () => {
      const { router, repositories } = renderFirearm('/inventario/armas/nueva');
      const sheet = await dialog();
      expect(within(sheet).getByRole('heading', { name: 'Nueva arma' })).toBeVisible();

      await userEvent.type(field(sheet, 'Tiros previos al registro'), '12,5');
      await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar arma' }));
      expect(within(sheet).getByText('Ingresá la marca')).toBeInTheDocument();
      expect(within(sheet).getByText('Ingresá el modelo')).toBeInTheDocument();
      expect(within(sheet).getByText('Ingresá el calibre')).toBeInTheDocument();
      expect(
        within(sheet).getByText('Ingresá un número entero, sin decimales'),
      ).toBeInTheDocument();
      expect(field(sheet, /Marca/)).toHaveFocus();
      expect(repositories.firearms.create).not.toHaveBeenCalled();

      await userEvent.type(field(sheet, /Marca/), 'CZ');
      await userEvent.type(field(sheet, /Modelo/), 'Shadow 2');
      await userEvent.type(within(sheet).getByRole('combobox', { name: /Calibre/ }), '9×19 mm');
      await userEvent.clear(field(sheet, 'Tiros previos al registro'));
      await userEvent.type(field(sheet, 'Tiros previos al registro'), '1.150');
      await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar arma' }));

      expect(repositories.firearms.create).toHaveBeenCalledWith(
        ANA.uid,
        {
          brand: 'CZ',
          model: 'Shadow 2',
          caliber: '9×19 mm',
          purchaseDate: null,
          purchasePlace: '',
          priorShots: 1150,
          photos: [],
        },
        'firearm-1',
      );
      await waitFor(() =>
        expect(router.state.location.pathname).toBe('/inventario/armas/firearm-1'),
      );
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Shadow 2' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Arma agregada')).toBeInTheDocument();
    });

    it('la fecha de compra no puede ser futura', async () => {
      renderFirearm('/inventario/armas/glock/editar');
      const sheet = await dialog();
      const date = within(sheet).getByLabelText('Fecha de compra');
      await userEvent.clear(date);
      await userEvent.type(date, '2999-01-01');
      await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar cambios' }));
      expect(within(sheet).getByText('La fecha no puede ser futura')).toBeInTheDocument();
      expect(date).toHaveFocus();
    });

    it('edición: quitar una foto la borra de Storage recién después de guardar', async () => {
      const { repositories, photos } = renderFirearm();
      await heading();
      await userEvent.click(screen.getByRole('link', { name: 'Editar' }));
      const sheet = await dialog();
      expect(field(sheet, /Marca/)).toHaveValue('Glock');
      expect(field(sheet, 'Tiros previos al registro')).toHaveValue('1200');

      await userEvent.click(within(sheet).getByRole('button', { name: 'Quitar foto 1' }));
      expect(photos.remove).not.toHaveBeenCalled();
      await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar cambios' }));

      expect(repositories.firearms.update).toHaveBeenCalledWith(ANA.uid, GLOCK.id, {
        brand: 'Glock',
        model: '17 Gen5',
        caliber: '9×19 mm',
        purchaseDate: '2023-03-14',
        purchasePlace: 'Armería Centro',
        priorShots: 1200,
        photos: [GLOCK.photos[1]],
      });
      await waitFor(() => expect(photos.remove).toHaveBeenCalledWith(GLOCK.photos[0]));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('si no se puede guardar, avisa, no borra fotos y deja el sheet abierto', async () => {
      const { repositories, photos } = renderFirearm('/inventario/armas/glock/editar');
      repositories.firearms.update.mockRejectedValueOnce(new Error('sin permiso'));
      const sheet = await dialog();
      await userEvent.click(within(sheet).getByRole('button', { name: 'Quitar foto 1' }));
      await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar cambios' }));
      expect(await screen.findByText('No se pudo guardar')).toBeInTheDocument();
      expect(photos.remove).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('"atrás" cierra el sheet y vuelve al detalle', async () => {
      const { router } = renderFirearm();
      await heading();
      await userEvent.click(screen.getByRole('link', { name: 'Editar' }));
      await dialog();
      await act(() => router.navigate(-1));
      expect(router.state.location.pathname).toBe('/inventario/armas/glock');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
