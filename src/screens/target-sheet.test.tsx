import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '@/components/auth-provider';
import { InventoryProvider } from '@/components/inventory-provider';
import { PhotoProvider } from '@/components/photo-provider';
import { ToastProvider } from '@/components/toast-provider';
import { routes } from '@/routes';
import { ANA, createFakeAuth } from '@/test/fake-auth';
import { B8, createFakeInventory, IPSC_CLASSIC, ISSF } from '@/test/fake-inventory';
import { createFakePhotos } from '@/test/fake-photos';

type InventoryOptions = Parameters<typeof createFakeInventory>[0];

function renderTargets(path = '/inventario/blancos', options?: InventoryOptions) {
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
  return { ...inventory, photos, router };
}

const cards = async () => within(await screen.findByRole('list', { name: 'Blancos' }));
const dialog = () => screen.findByRole('dialog');

/** Valores de las filas de zonas: `[puntaje, diámetro]`. */
function zoneRows(sheet: HTMLElement) {
  const group = within(sheet).getByRole('group', { name: 'Zonas de puntaje' });
  const scores = within(group).queryAllByRole('textbox', { name: /^Puntaje de la zona/ });
  const diameters = within(group).queryAllByRole('textbox', { name: /^Diámetro de la zona/ });
  return scores.map((score, index) => [
    (score as HTMLInputElement).value,
    (diameters[index] as HTMLInputElement).value,
  ]);
}

describe('Inventario: blancos', () => {
  it('tarjetas con el nombre y el resumen de la geometría; los archivados no', async () => {
    renderTargets();
    expect(await screen.findByRole('tab', { name: 'Blancos 2', selected: true })).toBeVisible();
    const list = await cards();
    const issf = list.getByRole('link', { name: 'Editar ISSF Pistola Precisión' });
    expect(issf).toHaveTextContent('Anillos · Ø 500 mm · 10 zonas');
    expect(issf).toHaveAttribute('href', '/inventario/blancos/issf/editar');
    expect(list.getByRole('link', { name: 'Editar IPSC Classic' })).toHaveTextContent(
      'Sin zonas · puntaje manual',
    );
    expect(list.queryByText(/NRA B-8/)).not.toBeInTheDocument();
  });

  it('con "Mostrar archivados" aparece el archivado y se puede restaurar', async () => {
    const { repositories, targets } = renderTargets();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Mostrar archivados (1)' }));
    const list = await cards();
    expect(list.getByText('NRA B-8')).toBeInTheDocument();
    expect(list.getByText('Archivado')).toBeInTheDocument();

    await userEvent.click(list.getByRole('button', { name: 'Restaurar NRA B-8' }));
    expect(repositories.targets.setArchived).toHaveBeenCalledWith(ANA.uid, B8.id, false);
    expect(targets().find((item) => item.id === B8.id)?.archived).toBe(false);
    expect(await screen.findByText('Blanco restaurado')).toBeInTheDocument();
  });

  it('sin blancos muestra el estado vacío con la acción', async () => {
    renderTargets('/inventario/blancos', { targets: [] });
    expect(await screen.findByRole('heading', { name: 'Sin blancos' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Nuevo blanco' })).toHaveLength(2);
  });

  describe('alta (M12)', () => {
    async function openNew(options?: InventoryOptions) {
      const result = renderTargets('/inventario/blancos', options);
      await userEvent.click((await screen.findAllByRole('link', { name: 'Nuevo blanco' }))[0]!);
      expect(result.router.state.location.pathname).toBe('/inventario/blancos/nuevo');
      return { ...result, sheet: await dialog() };
    }

    it('valida los obligatorios y enfoca el primero', async () => {
      const { sheet, repositories } = await openNew();
      await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar blanco' }));
      expect(within(sheet).getByText('Ingresá el nombre')).toBeInTheDocument();
      expect(
        within(sheet).getByText('Ingresá el diámetro de la zona exterior'),
      ).toBeInTheDocument();
      expect(
        within(sheet).getByText('Agregá al menos una zona o usá «Generar»'),
      ).toBeInTheDocument();
      expect(within(sheet).getByRole('textbox', { name: /Nombre/ })).toHaveFocus();
      expect(repositories.targets.create).not.toHaveBeenCalled();
    });

    it('"Generar" crea N anillos uniformes y guarda las zonas', async () => {
      const { sheet, repositories, router } = await openNew();
      await userEvent.type(within(sheet).getByRole('textbox', { name: /Nombre/ }), 'Blanco 25 m');

      // Sin diámetro exterior no se puede generar.
      await userEvent.click(within(sheet).getByRole('button', { name: 'Generar' }));
      expect(
        within(sheet).getByText('Primero ingresá el diámetro de la zona exterior'),
      ).toBeInTheDocument();

      await userEvent.type(
        within(sheet).getByRole('textbox', { name: /Diámetro de la zona exterior/ }),
        '200',
      );
      const count = within(sheet).getByRole('textbox', { name: 'Cantidad de zonas' });
      await userEvent.clear(count);
      await userEvent.type(count, '4');
      await userEvent.click(within(sheet).getByRole('button', { name: 'Generar' }));
      expect(zoneRows(sheet)).toEqual([
        ['4', '50'],
        ['3', '100'],
        ['2', '150'],
        ['1', '200'],
      ]);

      await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar blanco' }));
      expect(repositories.targets.create).toHaveBeenCalledWith(
        ANA.uid,
        {
          name: 'Blanco 25 m',
          photo: null,
          scoring: 'rings',
          referenceSizeMm: 200,
          zones: [
            { score: 4, diameterMm: 50 },
            { score: 3, diameterMm: 100 },
            { score: 2, diameterMm: 150 },
            { score: 1, diameterMm: 200 },
          ],
        },
        'target-1',
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(router.state.location.pathname).toBe('/inventario/blancos');
      expect(screen.getByText('Blanco agregado')).toBeInTheDocument();
      expect((await cards()).getByText('Blanco 25 m')).toBeInTheDocument();
    });

    it('marca las zonas inválidas y enfoca la primera', async () => {
      const { sheet, repositories } = await openNew();
      await userEvent.type(within(sheet).getByRole('textbox', { name: /Nombre/ }), 'Propio');
      await userEvent.type(
        within(sheet).getByRole('textbox', { name: /Diámetro de la zona exterior/ }),
        '100',
      );
      for (const [score, diameter] of [
        ['10', '60'],
        ['9', '40'],
        ['8', '120'],
      ]) {
        await userEvent.click(within(sheet).getByRole('button', { name: 'Agregar zona' }));
        // El foco va al puntaje de la zona nueva.
        await userEvent.keyboard(score!);
        const rows = within(sheet).getAllByRole('textbox', { name: /^Diámetro de la zona/ });
        await userEvent.type(rows[rows.length - 1]!, diameter!);
      }

      await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar blanco' }));
      expect(within(sheet).getByText('Revisá las zonas marcadas')).toBeInTheDocument();
      expect(
        within(sheet).getByText('Tiene que ser mayor que el de la zona 10 (60 mm)'),
      ).toBeInTheDocument();
      expect(
        within(sheet).getByText('No puede superar el tamaño de referencia'),
      ).toBeInTheDocument();
      const second = within(sheet).getByRole('textbox', { name: 'Diámetro de la zona 2 en mm' });
      expect(second).toHaveFocus();
      expect(second).toHaveAccessibleDescription(
        'Tiene que ser mayor que el de la zona 10 (60 mm)',
      );
      expect(repositories.targets.create).not.toHaveBeenCalled();

      await userEvent.click(within(sheet).getByRole('button', { name: 'Quitar la zona 3' }));
      await userEvent.clear(second);
      await userEvent.type(second, '80,5');
      await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar blanco' }));
      expect(repositories.targets.create).toHaveBeenCalledWith(
        ANA.uid,
        expect.objectContaining({
          zones: [
            { score: 10, diameterMm: 60 },
            { score: 9, diameterMm: 80.5 },
          ],
        }),
        expect.any(String),
      );
    });

    it('"Sin zonas" oculta las zonas, cambia la referencia y no las guarda', async () => {
      const { sheet, repositories } = await openNew();
      await userEvent.type(within(sheet).getByRole('textbox', { name: /Nombre/ }), 'IPSC');
      await userEvent.click(within(sheet).getByRole('radio', { name: 'Sin zonas' }));
      expect(within(sheet).queryByRole('group', { name: 'Zonas de puntaje' })).toBeNull();
      expect(within(sheet).queryByRole('button', { name: 'Generar' })).toBeNull();
      expect(within(sheet).getByText(/el puntaje se carga a mano/)).toBeInTheDocument();
      await userEvent.type(
        within(sheet).getByRole('textbox', { name: /Ancho de referencia del blanco/ }),
        '460',
      );
      await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar blanco' }));
      expect(repositories.targets.create).toHaveBeenCalledWith(
        ANA.uid,
        { name: 'IPSC', photo: null, scoring: 'none', referenceSizeMm: 460, zones: [] },
        expect.any(String),
      );
    });
  });

  describe('edición', () => {
    it('tocar la tarjeta abre el blanco con sus zonas y guarda los cambios', async () => {
      const { repositories, router } = renderTargets();
      await userEvent.click(
        (await cards()).getByRole('link', { name: 'Editar ISSF Pistola Precisión' }),
      );
      expect(router.state.location.pathname).toBe('/inventario/blancos/issf/editar');
      const sheet = await dialog();
      expect(within(sheet).getByRole('heading', { name: 'Editar blanco' })).toBeInTheDocument();
      expect(within(sheet).getByRole('radio', { name: 'Anillos concéntricos' })).toBeChecked();
      expect(zoneRows(sheet)).toHaveLength(10);
      expect(zoneRows(sheet)[0]).toEqual(['10', '50']);

      const name = within(sheet).getByRole('textbox', { name: /Nombre/ });
      await userEvent.clear(name);
      await userEvent.type(name, 'ISSF 25 m');
      await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar cambios' }));
      expect(repositories.targets.update).toHaveBeenCalledWith(ANA.uid, ISSF.id, {
        name: 'ISSF 25 m',
        photo: null,
        scoring: 'rings',
        referenceSizeMm: 500,
        zones: ISSF.zones,
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(router.state.location.pathname).toBe('/inventario/blancos');
    });

    it('quitar la foto la borra de Storage recién después de guardar', async () => {
      const { repositories, photos } = renderTargets(
        `/inventario/blancos/${IPSC_CLASSIC.id}/editar`,
      );
      const sheet = await dialog();
      await userEvent.click(within(sheet).getByRole('button', { name: /Quitar/ }));
      expect(photos.repository.remove).not.toHaveBeenCalled();
      await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar cambios' }));
      expect(repositories.targets.update).toHaveBeenCalledWith(
        ANA.uid,
        IPSC_CLASSIC.id,
        expect.objectContaining({ photo: null }),
      );
      await waitFor(() =>
        expect(photos.repository.remove).toHaveBeenCalledWith(IPSC_CLASSIC.photo),
      );
    });

    it('archivar desde la edición lo saca de la lista', async () => {
      const { repositories } = renderTargets(`/inventario/blancos/${ISSF.id}/editar`);
      const sheet = await dialog();
      await userEvent.click(within(sheet).getByRole('button', { name: 'Archivar blanco' }));
      expect(repositories.targets.setArchived).toHaveBeenCalledWith(ANA.uid, ISSF.id, true);
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(await screen.findByText('Blanco archivado')).toBeInTheDocument();
      expect((await cards()).queryByText('ISSF Pistola Precisión')).not.toBeInTheDocument();
    });

    it('un blanco que no existe vuelve a la lista', async () => {
      const { router } = renderTargets('/inventario/blancos/nada/editar');
      await waitFor(() => expect(router.state.location.pathname).toBe('/inventario/blancos'));
    });
  });
});
