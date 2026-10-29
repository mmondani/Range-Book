import { describe, expect, it } from 'vitest';
import type { Calibration } from '@/lib/calibration';
import {
  addPhotos,
  emptyDataset,
  evaluablePhotos,
  parseDataset,
  serializeDataset,
  setPhotoStatus,
  updatePhoto,
  upsertTarget,
  type Dataset,
} from './dataset';

const ISSF = {
  name: 'ISSF Pistola Precisión',
  scoring: 'rings' as const,
  referenceSizeMm: 500,
  zones: [
    { score: 10, diameterMm: 50 },
    { score: 9, diameterMm: 100 },
  ],
};

const calibration: Calibration = {
  kind: 'ring',
  width: 4000,
  height: 3000,
  center: { x: 2000, y: 1500 },
  edge: { x: 2100, y: 1500 },
  diameterMm: 100,
  shape: { angle: 0.3, ratio: 0.9 },
};

/** Set con una foto marcada del todo y otra sin marcar. */
function sample(): Dataset {
  const { dataset, id } = upsertTarget(emptyDataset(), ISSF);
  const withPhotos = addPhotos(dataset, [
    { file: '001.jpg', width: 4000, height: 3000 },
    { file: '002.jpg', width: 3000, height: 4000 },
  ]);
  return updatePhoto(withPhotos, '001.jpg', {
    caliber: '9×19 mm',
    targetId: id,
    shots: 3,
    calibration,
    impacts: [
      { x: 2010.5, y: 1490.25, tags: [] },
      { x: 2030, y: 1520, tags: ['touching'] },
      { x: 2032, y: 1524, tags: ['touching', 'old'] },
    ],
    conditions: ['shadow', 'angled'],
    notes: 'Dos pegados en el 10',
  });
}

describe('serializeDataset y parseDataset', () => {
  it('ida y vuelta sin perder nada, con las coordenadas en píxeles de la original', () => {
    const dataset = sample();
    const parsed = parseDataset(serializeDataset(dataset));
    expect(parsed).toEqual({ dataset });
    const photo = dataset.photos[0]!;
    expect(photo.calibration).toEqual(calibration);
    expect(photo.impacts[0]).toEqual({ x: 2010.5, y: 1490.25, tags: [] });
  });

  it('el archivo lleva la versión del formato', () => {
    expect(JSON.parse(serializeDataset(emptyDataset()))).toEqual({
      version: 1,
      targets: [],
      photos: [],
    });
  });

  it('avisa si el archivo está dañado o es de otra versión', () => {
    expect(parseDataset('{')).toEqual({ error: 'El archivo no es un JSON válido' });
    expect(parseDataset('[]')).toEqual({ error: 'El archivo no es un set de fotos' });
    expect(parseDataset('{"version":2,"targets":[],"photos":[]}')).toEqual({
      error: 'Versión del set desconocida: 2',
    });
  });

  it('dice qué foto está mal', () => {
    const data = JSON.parse(serializeDataset(sample())) as Dataset;
    const broken = (change: (photo: Record<string, unknown>) => void) => {
      const copy = structuredClone(data);
      change(copy.photos[0] as unknown as Record<string, unknown>);
      return parseDataset(JSON.stringify(copy));
    };
    expect(broken((photo) => (photo.width = 0))).toEqual({
      error: 'Foto «001.jpg»: el tamaño no es válido',
    });
    expect(broken((photo) => (photo.targetId = 'otro'))).toEqual({
      error: 'Foto «001.jpg»: el blanco no existe',
    });
    expect(broken((photo) => (photo.calibration = { kind: 'ring' }))).toEqual({
      error: 'Foto «001.jpg»: la calibración no es válida',
    });
    expect(broken((photo) => (photo.impacts = [{ x: 1, y: 2, tags: ['raro'] }]))).toEqual({
      error: 'Foto «001.jpg», impacto 1: valor desconocido',
    });
    expect(broken((photo) => (photo.shots = 0))).toEqual({
      error: 'Foto «001.jpg»: los disparos no son válidos',
    });
  });
});

describe('addPhotos', () => {
  it('suma las fotos nuevas sin marcar y no repite las que ya están', () => {
    const dataset = addPhotos(sample(), [
      { file: '001.jpg', width: 1, height: 1 },
      { file: '003.jpg', width: 2000, height: 1500 },
    ]);
    expect(dataset.photos.map((photo) => photo.file)).toEqual(['001.jpg', '002.jpg', '003.jpg']);
    expect(dataset.photos[0]!.width).toBe(4000);
    expect(dataset.photos[2]).toMatchObject({ status: 'pending', impacts: [], calibration: null });
  });
});

describe('estados', () => {
  it('una foto pasa a "en progreso" al marcar algo', () => {
    const dataset = sample();
    expect(dataset.photos[0]!.status).toBe('in-progress');
    expect(dataset.photos[1]!.status).toBe('pending');
    // Cambiar solo los datos no la pone en progreso.
    const notes = updatePhoto(dataset, '002.jpg', { notes: 'hola' });
    expect(notes.photos[1]!.status).toBe('pending');
    const marked = updatePhoto(dataset, '002.jpg', { impacts: [{ x: 1, y: 1, tags: [] }] });
    expect(marked.photos[1]!.status).toBe('in-progress');
  });

  it('"lista" y "descartada" se eligen a mano y se pueden deshacer', () => {
    const done = setPhotoStatus(sample(), '001.jpg', 'done');
    expect(done.photos[0]!.status).toBe('done');
    // Seguir marcando una foto lista no la saca de "lista".
    expect(updatePhoto(done, '001.jpg', { notes: 'x' }).photos[0]!.status).toBe('done');
    expect(setPhotoStatus(done, '001.jpg', 'open').photos[0]!.status).toBe('in-progress');

    const discarded = setPhotoStatus(sample(), '002.jpg', 'discarded');
    expect(discarded.photos[1]!.status).toBe('discarded');
    expect(setPhotoStatus(discarded, '002.jpg', 'open').photos[1]!.status).toBe('pending');
  });

  it('solo se evalúan las fotos listas con calibración', () => {
    let dataset = setPhotoStatus(sample(), '001.jpg', 'done');
    dataset = setPhotoStatus(dataset, '002.jpg', 'done');
    expect(evaluablePhotos(dataset).map((photo) => photo.file)).toEqual(['001.jpg']);
  });
});

describe('upsertTarget', () => {
  it('suma blancos con un id a partir del nombre', () => {
    const { dataset, id } = upsertTarget(emptyDataset(), ISSF);
    expect(id).toBe('issf-pistola-precision');
    const other = upsertTarget(dataset, { ...ISSF, name: 'ISSF Pistola Precisión ' });
    expect(other.id).toBe('issf-pistola-precision-2');
  });

  it('si ya hay uno con el mismo nombre, lo reemplaza', () => {
    const { dataset, id } = upsertTarget(emptyDataset(), ISSF);
    const updated = upsertTarget(dataset, { ...ISSF, referenceSizeMm: 400 });
    expect(updated.id).toBe(id);
    expect(updated.dataset.targets).toEqual([{ id, ...ISSF, referenceSizeMm: 400 }]);
  });
});
