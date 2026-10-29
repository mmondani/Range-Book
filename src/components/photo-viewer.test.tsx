import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { usePhotoViewer } from '@/hooks/use-photo-viewer';
import { storedPhotos } from '@/lib/photos';
import { createFakePhotos } from '@/test/fake-photos';
import { PhotoProvider } from './photo-provider';
import { PhotoViewer } from './photo-viewer';

const PHOTOS = storedPhotos([
  'users/ana/sessions/s1/a.jpg',
  'users/ana/sessions/s1/b.jpg',
  'users/ana/sessions/s1/c.jpg',
]);

/** Botones que abren el visor en cada foto, como en una galería. */
function Harness() {
  const viewer = usePhotoViewer();
  return (
    <>
      {PHOTOS.map((_, index) => (
        <button key={index} type="button" onClick={() => viewer.open(index)}>
          {`Abrir ${index + 1}`}
        </button>
      ))}
      {viewer.index !== null && (
        <PhotoViewer
          photos={PHOTOS}
          start={viewer.index}
          label="Fotos del polígono"
          onClose={viewer.close}
        />
      )}
    </>
  );
}

async function openViewer(index = 2) {
  const { repository } = createFakePhotos();
  const router = createMemoryRouter([{ path: '/sesiones/s1', element: <Harness /> }], {
    initialEntries: ['/', '/sesiones/s1'],
    initialIndex: 1,
  });
  render(
    <PhotoProvider repository={repository}>
      <RouterProvider router={router} />
    </PhotoProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: `Abrir ${index}` }));
  const viewer = screen.getByRole('dialog', { name: 'Fotos del polígono' });
  return { router, viewer };
}

const shown = (viewer: HTMLElement) => within(viewer).findByRole('img', { name: /^Foto \d de 3$/ });

describe('PhotoViewer', () => {
  it('abre en la foto tocada, con el contador', async () => {
    const { viewer } = await openViewer(2);
    expect(await shown(viewer)).toHaveAttribute(
      'src',
      'https://storage.test/users/ana/sessions/s1/b.jpg',
    );
    expect(viewer).toHaveTextContent('2 / 3');
    expect(within(viewer).getByRole('button', { name: 'Cerrar' })).toHaveFocus();
  });

  it('anterior y siguiente, con los botones y con las flechas del teclado', async () => {
    const { viewer } = await openViewer(1);
    const previous = within(viewer).getByRole('button', { name: 'Foto anterior' });
    expect(previous).toBeDisabled();

    await userEvent.click(within(viewer).getByRole('button', { name: 'Foto siguiente' }));
    expect(viewer).toHaveTextContent('2 / 3');
    await userEvent.keyboard('{ArrowRight}');
    expect(viewer).toHaveTextContent('3 / 3');
    expect(within(viewer).getByRole('button', { name: 'Foto siguiente' })).toBeDisabled();
    await userEvent.keyboard('{ArrowLeft}');
    expect(viewer).toHaveTextContent('2 / 3');
  });

  it('deslizar en horizontal cambia de foto', async () => {
    const { viewer } = await openViewer(2);
    const frame = (await shown(viewer)).parentElement!;
    const touch = { pointerId: 1, button: 0, pointerType: 'touch' };
    fireEvent.pointerDown(frame, { ...touch, clientX: 300, clientY: 400 });
    fireEvent.pointerMove(frame, { ...touch, clientX: 180, clientY: 410 });
    fireEvent.pointerUp(frame, { ...touch, clientX: 180, clientY: 410 });
    expect(viewer).toHaveTextContent('3 / 3');
  });

  it('acerca y aleja con los botones; al cambiar de foto vuelve a verse entera', async () => {
    const { viewer } = await openViewer(2);
    const zoomOut = within(viewer).getByRole('button', { name: 'Alejar' });
    expect(zoomOut).toBeDisabled();

    await userEvent.click(within(viewer).getByRole('button', { name: 'Acercar' }));
    expect(zoomOut).toBeEnabled();
    expect((await shown(viewer)).style.width).toBe('200%');

    await userEvent.click(within(viewer).getByRole('button', { name: 'Foto siguiente' }));
    expect(within(viewer).getByRole('button', { name: 'Alejar' })).toBeDisabled();
  });

  it('"Cerrar" y Escape vuelven atrás en el historial', async () => {
    const { router, viewer } = await openViewer(2);
    expect(router.state.location.state).toMatchObject({ photoViewer: { index: 1 } });
    await userEvent.click(within(viewer).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sesiones/s1');

    await userEvent.click(screen.getByRole('button', { name: 'Abrir 1' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('"atrás" lo cierra', async () => {
    const { router } = await openViewer(2);
    await act(() => router.navigate(-1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sesiones/s1');
  });
});
