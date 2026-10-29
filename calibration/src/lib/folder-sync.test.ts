import { describe, expect, it } from 'vitest';
import { createFakeFolder, fakeImage, fakeMeasure } from '../test/fake-folder';
import { addPhotos, emptyDataset, parseDataset, serializeDataset, updatePhoto } from './dataset';
import { importPhotos, openDataset, saveDataset, type OpenedDataset } from './folder-sync';

function opened(result: OpenedDataset | { error: string }): OpenedDataset {
  if ('error' in result) throw new Error(result.error);
  return result;
}

describe('openDataset', () => {
  it('sin dataset.json, arranca un set con las imágenes de la carpeta', async () => {
    const { folder } = createFakeFolder({
      '002.jpg': fakeImage(3000, 4000),
      '001.JPG': fakeImage(4000, 3000),
      'notas.txt': 'no es una foto',
    });
    const { dataset, missing, unreadable } = opened(await openDataset(folder, fakeMeasure));
    expect(missing).toEqual([]);
    expect(unreadable).toEqual([]);
    expect(
      dataset.photos.map(({ file, width, height, status }) => [file, width, height, status]),
    ).toEqual([
      ['001.JPG', 4000, 3000, 'pending'],
      ['002.jpg', 3000, 4000, 'pending'],
    ]);
  });

  it('con dataset.json, conserva lo marcado y suma las fotos nuevas', async () => {
    const saved = updatePhoto(
      addPhotos(emptyDataset(), [
        { file: '001.jpg', width: 4000, height: 3000 },
        { file: 'borrada.jpg', width: 10, height: 10 },
      ]),
      '001.jpg',
      { impacts: [{ x: 1, y: 2, tags: ['old'] }] },
    );
    const { folder } = createFakeFolder({
      'dataset.json': serializeDataset(saved),
      '001.jpg': fakeImage(4000, 3000),
      '003.jpg': fakeImage(2000, 1500),
      'rota.jpg': 'no se puede leer',
    });
    const { dataset, missing, unreadable } = opened(await openDataset(folder, fakeMeasure));
    expect(dataset.photos.map((photo) => photo.file)).toEqual([
      '001.jpg',
      'borrada.jpg',
      '003.jpg',
    ]);
    expect(dataset.photos[0]).toEqual(saved.photos[0]);
    expect(missing).toEqual(['borrada.jpg']);
    expect(unreadable).toEqual(['rota.jpg']);
  });

  it('si dataset.json está dañado, no lo abre ni lo pisa', async () => {
    const { folder } = createFakeFolder({ 'dataset.json': '{"version": 9}' });
    expect(await openDataset(folder, fakeMeasure)).toEqual({
      error: 'dataset.json: Versión del set desconocida: 9',
    });
    expect(folder.writeFile).not.toHaveBeenCalled();
  });
});

describe('importPhotos y saveDataset', () => {
  it('copia las fotos a la carpeta y las suma; saltea repetidas y archivos que no son imágenes', async () => {
    const { folder, files } = createFakeFolder({ '001.jpg': fakeImage(4000, 3000) });
    const { dataset } = opened(await openDataset(folder, fakeMeasure));
    const result = await importPhotos(
      folder,
      dataset,
      [
        new File([fakeImage(2000, 1500)], '002.jpg'),
        new File([fakeImage(1, 1)], '001.jpg'),
        new File(['hola'], 'notas.txt'),
      ],
      fakeMeasure,
    );
    expect(result.dataset.photos.map((photo) => photo.file)).toEqual(['001.jpg', '002.jpg']);
    expect(result.dataset.photos[1]).toMatchObject({ width: 2000, height: 1500 });
    expect(result.skipped).toEqual(['001.jpg', 'notas.txt']);
    expect(await files.get('002.jpg')?.text()).toBe(fakeImage(2000, 1500));
  });

  it('lo guardado se vuelve a abrir igual', async () => {
    const { folder, text } = createFakeFolder({ '001.jpg': fakeImage(4000, 3000) });
    const { dataset } = opened(await openDataset(folder, fakeMeasure));
    const marked = updatePhoto(dataset, '001.jpg', { notes: 'ok', shots: 5 });
    await saveDataset(folder, marked);
    expect(parseDataset((await text('dataset.json'))!)).toEqual({ dataset: marked });
    expect(await openDataset(folder, fakeMeasure)).toEqual({
      dataset: marked,
      missing: [],
      unreadable: [],
    });
  });
});
