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
import { createFakeInventory, GLOCK, IPSC, SELLIER } from '@/test/fake-inventory';
import { createFakePhotos } from '@/test/fake-photos';
import { setDesktop } from '@/test/match-media';

type InventoryOptions = Parameters<typeof createFakeInventory>[0];

function renderInventory(path = '/inventario/municiones', options?: InventoryOptions) {
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
  return { ...inventory, router };
}

const list = (name: string) => screen.findByRole('region', { name });
// Solo las filas: no los `<li>` de las etiquetas que van adentro.
const names = (region: HTMLElement) =>
  within(region)
    .getAllByRole('listitem')
    .filter((item) => item.parentElement?.parentElement === region)
    .map((item) => item.querySelector('div')?.firstElementChild?.textContent);
const dialog = () => screen.findByRole('dialog');

describe('InventoryScreen', () => {
  it('/inventario abre Armas', async () => {
    const { router } = renderInventory('/inventario');
    expect(await screen.findByRole('tab', { name: 'Armas 2', selected: true })).toBeVisible();
    expect(router.state.location.pathname).toBe('/inventario/armas');
  });

  it('muestra las categorías con el contador de activos', async () => {
    renderInventory();
    expect(await screen.findByRole('tab', { name: 'Munición 2', selected: true })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Armas 2' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Configuraciones 1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Polígonos 2' })).toBeInTheDocument();
  });

  describe('armas', () => {
    const cards = async () => within(await screen.findByRole('list', { name: 'Armas' }));

    it('tarjetas con calibre, modificaciones activas y tiros acumulados', async () => {
      renderInventory('/inventario/armas');
      const list = await cards();
      const glock = await list.findByRole('link', { name: /Glock 17 Gen5/ });
      expect(glock).toHaveAttribute('href', '/inventario/armas/glock');
      expect(glock).toHaveTextContent('9×19 mm');
      // 1.200 previos + 210 en sesiones.
      expect(glock).toHaveTextContent('1.410 tiros acumulados');
      expect(await within(glock).findByText(/2 modificaciones/)).toBeInTheDocument();
      expect(list.getByRole('link', { name: /Ruger 10\/22/ })).toHaveTextContent(
        'Sin modificaciones',
      );
    });

    it('una archivada no aparece, salvo con "Mostrar archivados"', async () => {
      renderInventory('/inventario/armas');
      expect((await cards()).queryByText(/Bersa/)).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('checkbox', { name: 'Mostrar archivados (1)' }));
      const bersa = (await cards()).getByRole('link', { name: /Bersa Thunder 380/ });
      expect(bersa).toHaveTextContent('Archivada');
    });

    it('"Nueva arma" abre el formulario sobre la lista', async () => {
      const { router } = renderInventory('/inventario/armas');
      await userEvent.click(await screen.findByRole('link', { name: 'Nueva arma' }));
      expect(router.state.location.pathname).toBe('/inventario/armas/nueva');
      expect(within(await dialog()).getByRole('heading', { name: 'Nueva arma' })).toBeVisible();
      expect(screen.getByRole('list', { name: 'Armas' })).toBeInTheDocument();
    });

    it('sin armas muestra el estado vacío', async () => {
      renderInventory('/inventario/armas', { firearms: [] });
      expect(await screen.findByRole('heading', { name: 'Sin armas' })).toBeInTheDocument();
    });
  });

  describe('configuraciones', () => {
    it('muestra nombre, arma base y modificaciones; las archivadas no', async () => {
      renderInventory('/inventario/configuraciones');
      const region = await list('Configuraciones');
      expect(names(region)).toEqual(['Config. IPSC']);
      expect(region).toHaveTextContent('Base: Glock 17 Gen5');
      const tags = await within(region).findByRole('list', {
        name: 'Modificaciones de Config. IPSC',
      });
      expect(
        within(tags)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual(['Holosun 507C X2', 'Zev PRO Trigger']);
    });

    it('alta desde la lista: elige el arma y sus modificaciones', async () => {
      const { repositories } = renderInventory('/inventario/configuraciones');
      await userEvent.click(await screen.findByRole('link', { name: 'Nueva configuración' }));
      const sheet = await dialog();
      await userEvent.selectOptions(
        within(sheet).getByRole('combobox', { name: /Arma base/ }),
        'Glock 17 Gen5',
      );
      await userEvent.type(within(sheet).getByRole('textbox', { name: /Nombre/ }), 'Liviana');
      // La modificación archivada no se ofrece.
      expect(within(sheet).queryByRole('checkbox', { name: /Taran/ })).not.toBeInTheDocument();
      await userEvent.click(await within(sheet).findByRole('checkbox', { name: /Zev/ }));
      await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar configuración' }));

      expect(repositories.configurations.create).toHaveBeenCalledWith(ANA.uid, {
        name: 'Liviana',
        firearmId: GLOCK.id,
        modificationIds: ['zev'],
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(names(await list('Configuraciones'))).toEqual(['Config. IPSC', 'Liviana']);
    });

    it('editar desde la lista conserva el arma base', async () => {
      const { repositories } = renderInventory('/inventario/configuraciones');
      await userEvent.click(await screen.findByRole('button', { name: 'Editar Config. IPSC' }));
      const sheet = await dialog();
      expect(within(sheet).queryByRole('combobox')).not.toBeInTheDocument();
      expect(await within(sheet).findByRole('checkbox', { name: /Holosun/ })).toBeChecked();
      await userEvent.click(within(sheet).getByRole('checkbox', { name: /Holosun/ }));
      await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar cambios' }));
      expect(repositories.configurations.update).toHaveBeenCalledWith(ANA.uid, IPSC.id, {
        name: 'Config. IPSC',
        firearmId: GLOCK.id,
        modificationIds: ['zev'],
      });
    });
  });

  it('cambiar de categoría cambia la URL y el botón primario', async () => {
    const { router } = renderInventory();
    expect(await screen.findByRole('link', { name: 'Nueva munición' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Polígonos/ }));
    expect(router.state.location.pathname).toBe('/inventario/poligonos');
    expect(screen.getByRole('link', { name: 'Nuevo polígono' })).toBeInTheDocument();
    expect(names(await list('Polígonos'))).toEqual(['Club de Tiro Los Álamos', 'Polígono Norte']);
  });

  it('un archivado no aparece en la lista', async () => {
    renderInventory();
    const region = await list('Munición');
    expect(names(region)).toEqual(['CCI Standard Velocity', 'Magtech 9mm FMJ 115gr']);
    expect(within(region).queryByText(/Sellier/)).not.toBeInTheDocument();
  });

  it('con "Mostrar archivados" aparece marcado y se puede restaurar', async () => {
    const { router, repositories, ammunition } = renderInventory();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Mostrar archivados (1)' }));
    expect(router.state.location.search).toBe('?archivados=1');

    const region = await list('Munición');
    const archived = within(region).getAllByRole('listitem')[2]!;
    expect(archived).toHaveTextContent('Sellier & Bellot 9mm FMJ 124gr');
    expect(archived).toHaveTextContent('Archivado');

    await userEvent.click(
      within(archived).getByRole('button', { name: 'Restaurar Sellier & Bellot 9mm FMJ 124gr' }),
    );
    expect(repositories.ammunition.setArchived).toHaveBeenCalledWith(ANA.uid, SELLIER.id, false);
    expect(ammunition().find((item) => item.id === SELLIER.id)?.archived).toBe(false);
    expect(await screen.findByText('Munición restaurada')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Munición 3' })).toBeInTheDocument();
  });

  it('sin archivados no se muestra "Mostrar archivados"', async () => {
    renderInventory('/inventario/poligonos');
    await list('Polígonos');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('archivar desde la edición lo saca de la lista y se puede deshacer', async () => {
    const { router, repositories } = renderInventory('/inventario/poligonos');
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Polígono Norte' }));
    expect(router.state.location.pathname).toBe('/inventario/poligonos/norte/editar');

    await userEvent.click(
      within(await dialog()).getByRole('button', { name: 'Archivar polígono' }),
    );
    expect(repositories.ranges.setArchived).toHaveBeenCalledWith(ANA.uid, 'norte', true);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/inventario/poligonos');
    expect(names(await list('Polígonos'))).toEqual(['Club de Tiro Los Álamos']);

    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    await waitFor(() =>
      expect(names(screen.getByRole('region', { name: 'Polígonos' }))).toEqual([
        'Club de Tiro Los Álamos',
        'Polígono Norte',
      ]),
    );
  });

  it('alta de munición: valida, enfoca el primer error y guarda', async () => {
    const { router, repositories } = renderInventory();
    await userEvent.click(await screen.findByRole('link', { name: 'Nueva munición' }));
    expect(router.state.location.pathname).toBe('/inventario/municiones/nueva');
    const sheet = await dialog();
    expect(within(sheet).getByRole('heading', { name: 'Nueva munición' })).toBeInTheDocument();

    await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar munición' }));
    expect(within(sheet).getByText('Ingresá la marca')).toBeInTheDocument();
    expect(within(sheet).getByText('Ingresá el modelo')).toBeInTheDocument();
    expect(within(sheet).getByRole('textbox', { name: /Marca/ })).toHaveFocus();
    expect(repositories.ammunition.create).not.toHaveBeenCalled();

    await userEvent.type(within(sheet).getByRole('textbox', { name: /Marca/ }), ' Fiocchi ');
    expect(within(sheet).queryByText('Ingresá la marca')).not.toBeInTheDocument();
    await userEvent.type(within(sheet).getByRole('textbox', { name: /Modelo/ }), '9 Luger');
    await userEvent.type(within(sheet).getByRole('textbox', { name: 'Descripción' }), '124 gr');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar munición' }));

    expect(repositories.ammunition.create).toHaveBeenCalledWith(ANA.uid, {
      brand: 'Fiocchi',
      model: '9 Luger',
      description: '124 gr',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/inventario/municiones');
    expect(screen.getByText('Munición agregada')).toBeInTheDocument();
    expect(names(await list('Munición'))).toContain('Fiocchi 9 Luger');
  });

  it('edición de un polígono', async () => {
    const { repositories } = renderInventory('/inventario/poligonos');
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Polígono Norte' }));
    const sheet = await dialog();
    const address = within(sheet).getByRole('textbox', { name: 'Dirección' });
    expect(address).toHaveValue('Av. Siempreviva 742');
    await userEvent.clear(address);
    await userEvent.type(address, 'Ruta 8 km 60');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar cambios' }));

    expect(repositories.ranges.update).toHaveBeenCalledWith(ANA.uid, 'norte', {
      name: 'Polígono Norte',
      address: 'Ruta 8 km 60',
    });
    expect(await screen.findByText('Ruta 8 km 60')).toBeInTheDocument();
  });

  it('cerrar con cambios pide confirmación', async () => {
    renderInventory();
    await userEvent.click(await screen.findByRole('link', { name: 'Nueva munición' }));
    const sheet = await dialog();
    await userEvent.type(within(sheet).getByRole('textbox', { name: /Marca/ }), 'CCI');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Cancelar' }));

    const confirm = screen.getByRole('alertdialog', { name: '¿Descartar los cambios?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('"atrás" cierra el sheet', async () => {
    const { router } = renderInventory();
    await userEvent.click(await screen.findByRole('link', { name: 'Nueva munición' }));
    await dialog();
    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe('/inventario/municiones');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('al guardar vuelve atrás en el historial: "atrás" no reabre el sheet', async () => {
    const { router } = renderInventory('/inventario/poligonos');
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Polígono Norte' }));
    await userEvent.click(within(await dialog()).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.historyAction).toBe('POP');
    expect(router.state.location.pathname).toBe('/inventario/poligonos');
  });

  it('entrando por URL a un elemento que no existe vuelve a la lista', async () => {
    const { router } = renderInventory('/inventario/municiones/nada/editar');
    await list('Munición');
    expect(router.state.location.pathname).toBe('/inventario/municiones');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sin munición cargada muestra el estado vacío con la acción', async () => {
    renderInventory('/inventario/municiones', { ammunition: [] });
    expect(await screen.findByRole('heading', { name: 'Sin munición' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Nueva munición' })).toHaveLength(2);
  });

  it('si no se puede guardar, avisa y deja el sheet abierto', async () => {
    const { repositories } = renderInventory('/inventario/poligonos');
    repositories.ranges.create.mockRejectedValueOnce(new Error('sin permiso'));
    await userEvent.click(await screen.findByRole('link', { name: 'Nuevo polígono' }));
    const sheet = await dialog();
    await userEvent.type(within(sheet).getByRole('textbox', { name: /Nombre/ }), 'Club');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar polígono' }));
    expect(await screen.findByText('No se pudo guardar')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  describe('desktop', () => {
    it('muestra una tabla y busca sin distinguir acentos', async () => {
      setDesktop(true);
      renderInventory('/inventario/poligonos');
      const table = await screen.findByRole('table', { name: 'Polígonos' });
      expect(
        within(table)
          .getAllByRole('columnheader')
          .map((th) => th.textContent),
      ).toEqual(['Nombre', 'Dirección', 'Acciones']);
      expect(within(table).getAllByRole('row')).toHaveLength(3);

      await userEvent.type(
        screen.getByRole('searchbox', { name: 'Buscar en inventario' }),
        'alamos',
      );
      expect(within(table).getAllByRole('row')).toHaveLength(2);
      expect(table).toHaveTextContent('Club de Tiro Los Álamos');

      await userEvent.type(screen.getByRole('searchbox'), ' zzz');
      expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
    });

    it('los archivados se ven en la tabla con "Restaurar"', async () => {
      setDesktop(true);
      renderInventory('/inventario/municiones?archivados=1');
      const table = await screen.findByRole('table', { name: 'Munición' });
      const row = within(table).getByRole('row', { name: /Sellier/ });
      expect(row).toHaveTextContent('Archivado');
      expect(within(row).getByRole('button', { name: /Restaurar/ })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Mostrar archivados (1)' })).toBeChecked();
    });
  });
});
