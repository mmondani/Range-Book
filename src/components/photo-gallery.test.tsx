import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { storedPhotos } from '@/lib/photos';
import { createFakePhotos } from '@/test/fake-photos';
import { PhotoGallery } from './photo-gallery';
import { PhotoProvider } from './photo-provider';

const PATHS = ['users/ana/sessions/s1/a.jpg', 'users/ana/sessions/s1/b.jpg'];

function renderGallery(paths: string[], missing: string[] = []) {
  const { repository } = createFakePhotos({ missing });
  // El visor a pantalla completa usa el historial.
  return render(
    <MemoryRouter>
      <PhotoProvider repository={repository}>
        <PhotoGallery photos={storedPhotos(paths)} label="Fotos del polígono" />
      </PhotoProvider>
    </MemoryRouter>,
  );
}

describe('PhotoGallery', () => {
  it('muestra la primera foto y el contador', async () => {
    renderGallery(PATHS);
    expect(await screen.findByRole('img', { name: 'Foto 1 de 2' })).toHaveAttribute(
      'src',
      'https://storage.test/users/ana/sessions/s1/a.jpg',
    );
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver foto 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('cambia de foto con las miniaturas', async () => {
    renderGallery(PATHS);
    await userEvent.click(screen.getByRole('button', { name: 'Ver foto 2' }));
    expect(await screen.findByRole('img', { name: 'Foto 2 de 2' })).toHaveAttribute(
      'src',
      'https://storage.test/users/ana/sessions/s1/b.jpg',
    );
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('con una sola foto no muestra contador ni miniaturas', async () => {
    renderGallery(PATHS.slice(0, 1));
    expect(await screen.findByRole('img', { name: 'Foto 1 de 1' })).toBeInTheDocument();
    expect(screen.queryByText('1 / 1')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Ver foto/ })).not.toBeInTheDocument();
  });

  it('tocar la foto principal la abre a pantalla completa', async () => {
    renderGallery(PATHS);
    await userEvent.click(screen.getByRole('button', { name: 'Ver foto 2' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Ver la foto 2 de 2 en pantalla completa' }),
    );
    const viewer = screen.getByRole('dialog', { name: 'Fotos del polígono' });
    expect(viewer).toHaveTextContent('2 / 2');
  });

  it('sin fotos muestra un espacio vacío', () => {
    renderGallery([]);
    expect(screen.getByRole('group', { name: 'Fotos del polígono' })).toHaveTextContent(
      'Sin fotos',
    );
  });

  it('avisa si una foto no se puede cargar', async () => {
    renderGallery(PATHS.slice(0, 1), PATHS.slice(0, 1));
    expect(
      await screen.findByRole('img', { name: 'Foto 1 de 1: no se pudo cargar' }),
    ).toBeInTheDocument();
  });
});
