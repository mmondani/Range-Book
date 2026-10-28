import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compressImage } from '@/lib/image-compression';
import { storedPhotos, type PhotoDraft } from '@/lib/photos';
import { createFakePhotos, stubObjectUrls } from '@/test/fake-photos';
import { Field } from './field';
import { PhotoPicker } from './photo-picker';
import { PhotoProvider } from './photo-provider';
import { ToastProvider } from './toast-provider';

vi.mock('@/lib/image-compression', () => ({ compressImage: vi.fn() }));

const compressed = () => ({
  blob: new Blob(['jpeg'], { type: 'image/jpeg' }),
  width: 2000,
  height: 1500,
});
const image = (name: string) => new File(['raw'], name, { type: 'image/jpeg' });

let latest: PhotoDraft[] = [];

function Harness({
  initial = [],
  multiple,
  cover,
}: {
  initial?: PhotoDraft[];
  multiple?: boolean;
  cover?: boolean;
}) {
  const [photos, setPhotos] = useState(initial);
  return (
    <Field label="Fotos del polígono" kind="group">
      <PhotoPicker
        value={photos}
        onChange={(next) => {
          latest = next;
          setPhotos(next);
        }}
        multiple={multiple}
        cover={cover}
      />
    </Field>
  );
}

function renderPicker(props: Parameters<typeof Harness>[0] = {}) {
  const { repository } = createFakePhotos();
  return render(
    <PhotoProvider repository={repository}>
      <ToastProvider>
        <Harness {...props} />
      </ToastProvider>
    </PhotoProvider>,
  );
}

const galleryInput = () => screen.getByTestId('photo-gallery-input') as HTMLInputElement;

beforeEach(() => {
  stubObjectUrls();
  vi.mocked(compressImage).mockImplementation(async () => compressed());
  latest = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(compressImage).mockReset();
});

describe('PhotoPicker', () => {
  it('se etiqueta con el Field y ofrece cámara y galería', () => {
    renderPicker();
    expect(screen.getByRole('group', { name: 'Fotos del polígono' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cámara' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Galería' })).toBeInTheDocument();
    expect(screen.getByTestId('photo-camera-input')).toHaveAttribute('capture', 'environment');
    expect(galleryInput()).not.toHaveAttribute('capture');
    expect(galleryInput()).toHaveAttribute('multiple');
  });

  it('comprime las fotos elegidas y las agrega como pendientes', async () => {
    renderPicker({ initial: storedPhotos(['users/ana/sessions/s1/a.jpg']) });
    await userEvent.upload(galleryInput(), [image('1.jpg'), image('2.jpg')]);

    expect(await screen.findByRole('img', { name: 'Foto 3' })).toHaveAttribute(
      'src',
      'blob:preview-2',
    );
    expect(compressImage).toHaveBeenCalledTimes(2);
    expect(latest.map((photo) => photo.status)).toEqual(['stored', 'pending', 'pending']);
    expect(latest[1]).toMatchObject({ name: '1.jpg', blob: expect.any(Blob) });
  });

  it('muestra las fotos guardadas con la URL de Storage', async () => {
    renderPicker({ initial: storedPhotos(['users/ana/sessions/s1/a.jpg']) });
    expect(await screen.findByRole('img', { name: 'Foto 1' })).toHaveAttribute(
      'src',
      'https://storage.test/users/ana/sessions/s1/a.jpg',
    );
  });

  it('quita una foto', async () => {
    renderPicker({
      initial: storedPhotos(['users/ana/sessions/s1/a.jpg', 'users/ana/sessions/s1/b.jpg']),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Quitar foto 1' }));
    expect(latest).toEqual(storedPhotos(['users/ana/sessions/s1/b.jpg']));
    expect(screen.queryByRole('button', { name: 'Quitar foto 2' })).not.toBeInTheDocument();
  });

  it('con una sola foto, elegir otra la reemplaza', async () => {
    renderPicker({ initial: storedPhotos(['users/ana/rounds/r1/a.jpg']), multiple: false });
    expect(galleryInput()).not.toHaveAttribute('multiple');
    await userEvent.upload(galleryInput(), image('nueva.jpg'));
    await waitFor(() => expect(latest).toHaveLength(1));
    expect(latest[0]).toMatchObject({ status: 'pending', name: 'nueva.jpg' });
  });

  it('marca la primera foto como portada', async () => {
    renderPicker({
      initial: storedPhotos(['users/ana/firearms/f1/a.jpg', 'users/ana/firearms/f1/b.jpg']),
      cover: true,
    });
    expect(await screen.findByRole('img', { name: 'Portada' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Foto 2' })).toBeInTheDocument();
  });

  it('acepta fotos arrastradas', async () => {
    renderPicker();
    fireEvent.drop(screen.getByRole('group', { name: 'Fotos del polígono' }), {
      dataTransfer: { files: [image('arrastrada.jpg')], types: ['Files'] },
    });
    await waitFor(() => expect(latest).toHaveLength(1));
    expect(latest[0]).toMatchObject({ name: 'arrastrada.jpg' });
  });

  it('ignora los archivos que no son imágenes y avisa', async () => {
    renderPicker();
    fireEvent.drop(screen.getByRole('group', { name: 'Fotos del polígono' }), {
      dataTransfer: {
        files: [new File(['x'], 'notas.pdf', { type: 'application/pdf' })],
        types: ['Files'],
      },
    });
    expect(await screen.findByText('Solo se pueden agregar imágenes.')).toBeInTheDocument();
    expect(compressImage).not.toHaveBeenCalled();
    expect(latest).toEqual([]);
  });

  it('avisa si no puede leer una foto y agrega las demás', async () => {
    vi.mocked(compressImage)
      .mockRejectedValueOnce(new Error('formato no soportado'))
      .mockResolvedValueOnce(compressed());
    renderPicker();
    await userEvent.upload(galleryInput(), [image('rota.jpg'), image('buena.jpg')]);
    expect(await screen.findByText('No se pudo leer una foto.')).toBeInTheDocument();
    expect(latest).toHaveLength(1);
    expect(latest[0]).toMatchObject({ name: 'buena.jpg' });
  });
});
