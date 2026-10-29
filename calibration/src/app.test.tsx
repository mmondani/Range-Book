import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { targetClipboardText, type TargetDefinition } from '@/lib/targets';
import { setDesktop } from '@/test/match-media';
import { App } from './app';
import {
  addPhotos,
  emptyDataset,
  parseDataset,
  serializeDataset,
  setPhotoStatus,
  updatePhoto,
  upsertTarget,
  type Dataset,
} from './lib/dataset';
import type { PhotoDetection } from './lib/evaluation-runner';
import type { ToolServices } from './services';
import { createFakeFolder, fakeImage, fakeMeasure } from './test/fake-folder';

const ISSF: TargetDefinition = {
  name: 'ISSF Pistola Precisión',
  scoring: 'rings',
  referenceSizeMm: 500,
  zones: [
    { score: 10, diameterMm: 50 },
    { score: 9, diameterMm: 100 },
    { score: 1, diameterMm: 500 },
  ],
};
const IPSC: TargetDefinition = { name: 'IPSC', scoring: 'none', referenceSizeMm: 460, zones: [] };

beforeEach(() => {
  // Las fotos se ven a 1000 × 1000 px de pantalla, en un recuadro cuadrado (desktop).
  setDesktop(true);
  URL.createObjectURL = vi.fn(() => 'blob:foto');
});

function renderTool({
  files = {},
  supported = true,
  detect,
  folder: existing,
}: {
  files?: Record<string, string>;
  supported?: boolean;
  detect?: ToolServices['detectInPhoto'];
  folder?: ReturnType<typeof createFakeFolder>;
} = {}) {
  const fake = existing ?? createFakeFolder(files);
  const services: ToolServices = {
    supportsFolders: () => supported,
    pickFolder: vi.fn(async () => fake.folder),
    rememberedFolder: vi.fn(async () => null),
    measureImage: fakeMeasure,
    detectInPhoto:
      detect ??
      vi.fn(async (): Promise<PhotoDetection> => ({ impacts: [], center: null, holeMm: 9 })),
  };
  render(<App services={services} />);
  return { ...fake, services };
}

async function openFolder() {
  await userEvent.click(await screen.findByRole('button', { name: 'Abrir carpeta del set' }));
  return within(await screen.findByRole('navigation', { name: 'Fotos' }));
}

/** El `dataset.json` de la carpeta, cuando ya se guardó con `check`. */
async function savedDataset(
  text: (path: string) => Promise<string | null>,
  check: (d: Dataset) => void,
) {
  await waitFor(
    async () => {
      const parsed = parseDataset((await text('dataset.json')) ?? '');
      if ('error' in parsed) throw new Error(parsed.error);
      check(parsed.dataset);
    },
    { timeout: 2000 },
  );
}

/** La superficie de la foto, a 1000 × 1000 px de pantalla. */
function photoSurface(name: string | RegExp) {
  const surface = screen.getByRole('button', { name });
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 1000,
    height: 1000,
  } as DOMRect);
  return surface;
}

function tapPhoto(name: string | RegExp, x: number, y: number) {
  fireEvent.click(photoSurface(name), { clientX: x, clientY: y, detail: 1 });
}

/** Set con dos fotos de 1000 × 1000 px y el ISSF elegido en la primera. */
function setWithTarget(target = ISSF): Dataset {
  const { dataset, id } = upsertTarget(emptyDataset(), target);
  const photos = addPhotos(dataset, [
    { file: '001.jpg', width: 1000, height: 1000 },
    { file: '002.jpg', width: 1000, height: 1000 },
  ]);
  return updatePhoto(photos, '001.jpg', { targetId: id, shots: 3 });
}

const folderWith = (dataset: Dataset) => ({
  'dataset.json': serializeDataset(dataset),
  '001.jpg': fakeImage(1000, 1000),
  '002.jpg': fakeImage(1000, 1000),
});

describe('Carpeta del set', () => {
  it('sin la API de carpetas avisa que hace falta Chrome', async () => {
    renderTool({ supported: false });
    expect(await screen.findByText('Este navegador no permite abrir carpetas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir carpeta del set' })).not.toBeInTheDocument();
  });

  it('lista las fotos con su estado y agrega varias más a la vez', async () => {
    const saved = setPhotoStatus(setWithTarget(), '001.jpg', 'done');
    const { files, text } = renderTool({ files: folderWith(saved) });
    const list = await openFolder();
    expect(list.getByRole('button', { name: '001.jpg Lista' })).toBeInTheDocument();
    expect(list.getByRole('button', { name: '002.jpg Sin marcar' })).toBeInTheDocument();
    expect(list.getByRole('status')).toHaveTextContent('2 fotos · 1 listas');

    await userEvent.upload(screen.getByLabelText('Fotos para agregar'), [
      new File([fakeImage(2000, 1500)], '003.jpg', { type: 'image/jpeg' }),
      new File([fakeImage(800, 600)], '004.jpg', { type: 'image/jpeg' }),
    ]);
    expect(await list.findByRole('button', { name: '004.jpg Sin marcar' })).toBeInTheDocument();
    expect(list.getByRole('button', { name: '003.jpg Sin marcar' })).toBeInTheDocument();
    expect(await files.get('003.jpg')?.text()).toBe(fakeImage(2000, 1500));
    await savedDataset(text, (dataset) =>
      expect(dataset.photos.map((photo) => photo.file)).toEqual([
        '001.jpg',
        '002.jpg',
        '003.jpg',
        '004.jpg',
      ]),
    );
  });

  it('una foto sin blanco se ve igual, con el aviso de que falta el blanco', async () => {
    renderTool({ files: { '001.jpg': fakeImage(1000, 1000) } });
    await openFolder();
    expect(await screen.findByRole('img', { name: 'Foto 001.jpg' })).toBeInTheDocument();
    expect(screen.getByText(/^Elegí el blanco de la foto/)).toBeInTheDocument();
  });

  it('Página siguiente y anterior cambian de foto', async () => {
    renderTool({ files: folderWith(setWithTarget()) });
    const list = await openFolder();
    const current = () => list.getByRole('button', { current: true });
    expect(current()).toHaveTextContent('001.jpg');
    await userEvent.keyboard('{PageDown}');
    expect(current()).toHaveTextContent('002.jpg');
    await userEvent.keyboard('{PageDown}');
    expect(current()).toHaveTextContent('002.jpg');
    await userEvent.keyboard('{PageUp}');
    expect(current()).toHaveTextContent('001.jpg');
  });

  it('marcar como lista, descartar y recuperar', async () => {
    const { text } = renderTool({ files: folderWith(setWithTarget()) });
    const list = await openFolder();
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como lista' }));
    expect(list.getByRole('button', { name: '001.jpg Lista' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Volver a abrir' }));
    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(list.getByRole('button', { name: '001.jpg Descartada' })).toBeInTheDocument();
    await savedDataset(text, (dataset) => expect(dataset.photos[0]!.status).toBe('discarded'));
    await userEvent.click(screen.getByRole('button', { name: 'Recuperar' }));
    expect(list.getByRole('button', { name: '001.jpg Sin marcar' })).toBeInTheDocument();
  });

  it('al volver a abrir la carpeta, lo marcado sigue ahí', async () => {
    const { text, ...folder } = renderTool({ files: folderWith(setWithTarget()) });
    await openFolder();
    await userEvent.type(screen.getByRole('textbox', { name: /Calibre/ }), '9×19 mm');
    await savedDataset(text, (dataset) => expect(dataset.photos[0]!.caliber).toBe('9×19 mm'));

    cleanup();
    renderTool({ folder: { ...folder, text } });
    await openFolder();
    expect(screen.getByRole('textbox', { name: /Calibre/ })).toHaveValue('9×19 mm');
  });

  it('si dataset.json está dañado, no abre el set', async () => {
    renderTool({ files: { 'dataset.json': '{', '001.jpg': fakeImage(1, 1) } });
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir carpeta del set' }));
    expect(
      await screen.findByText('dataset.json: El archivo no es un JSON válido'),
    ).toBeInTheDocument();
  });
});

describe('Datos de la foto', () => {
  it('pega un blanco copiado de la app y lo usa en dos fotos', async () => {
    const { text } = renderTool({
      files: { '001.jpg': fakeImage(1000, 1000), '002.jpg': fakeImage(1000, 1000) },
    });
    await openFolder();
    const field = screen.getByRole('textbox', { name: 'O pegalo acá' });
    await userEvent.click(field);
    await userEvent.paste('hola');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar blanco' }));
    expect(screen.getByText(/El texto no es un blanco copiado de la app/)).toBeInTheDocument();

    await userEvent.clear(field);
    await userEvent.click(field);
    await userEvent.paste(targetClipboardText(ISSF));
    await userEvent.click(screen.getByRole('button', { name: 'Agregar blanco' }));
    expect(screen.getByText('Blanco «ISSF Pistola Precisión» agregado')).toBeInTheDocument();
    // La foto sin blanco pasa a usar el pegado.
    expect(screen.getByRole('combobox', { name: 'Blanco' })).toHaveDisplayValue(ISSF.name);

    await userEvent.keyboard('{PageDown}');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Blanco' }), ISSF.name);
    await savedDataset(text, (dataset) => {
      expect(dataset.targets).toEqual([{ id: 'issf-pistola-precision', ...ISSF }]);
      expect(dataset.photos.map((photo) => photo.targetId)).toEqual([
        'issf-pistola-precision',
        'issf-pistola-precision',
      ]);
    });
  });

  it('guarda calibre, disparos, condiciones y notas', async () => {
    const { text } = renderTool({ files: folderWith(setWithTarget()) });
    await openFolder();
    const shots = screen.getByRole('textbox', { name: 'Disparos de la ronda' });
    await userEvent.clear(shots);
    await userEvent.type(shots, '10');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sombra' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Flash' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Notas' }), 'Luz de costado');
    await savedDataset(text, (dataset) =>
      expect(dataset.photos[0]).toMatchObject({
        shots: 10,
        conditions: ['shadow', 'flash'],
        notes: 'Luz de costado',
      }),
    );
  });
});

describe('Marcado', () => {
  it('calibra un blanco con anillos, marca impactos con etiquetas, quita y deshace', async () => {
    const { text } = renderTool({ files: folderWith(setWithTarget()) });
    await openFolder();
    expect(await screen.findByRole('radio', { name: 'Calibrar' })).toBeChecked();

    // Anillo exterior (500 mm) a 250 px del centro: 1 mm por px.
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /Anillo marcado/ }), '500');
    tapPhoto('Ubicar centro en el punto indicado', 500, 500);
    tapPhoto('Ubicar anillo en el punto indicado', 750, 500);
    await savedDataset(text, (dataset) =>
      expect(dataset.photos[0]!.calibration).toMatchObject({
        kind: 'ring',
        center: { x: 500, y: 500 },
        edge: { x: 750, y: 500 },
        diameterMm: 500,
      }),
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Agregar' }));
    tapPhoto('Agregar impacto en el punto indicado', 510, 490);
    tapPhoto('Agregar impacto en el punto indicado', 530, 520);
    expect(screen.getByText('2 impactos marcados de 3 disparos')).toBeInTheDocument();
    expect(screen.getByText(/^Faltan 1 impactos/)).toBeInTheDocument();
    tapPhoto('Agregar impacto en el punto indicado', 600, 600);

    await userEvent.click(screen.getByRole('radio', { name: 'Etiquetar' }));
    tapPhoto('Elegir el impacto más cercano al punto indicado', 528, 522);
    const tags = within(screen.getByRole('group', { name: 'Impacto 2' }));
    await userEvent.click(tags.getByRole('checkbox', { name: 'Pegado o superpuesto' }));

    await userEvent.click(screen.getByRole('radio', { name: 'Quitar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Quitar impacto 3' }));
    expect(screen.getByText('2 impactos marcados de 3 disparos')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.getByText('3 impactos marcados de 3 disparos')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Quitar impacto 1' }));

    await savedDataset(text, (dataset) => {
      const photo = dataset.photos[0]!;
      expect(photo.status).toBe('in-progress');
      expect(photo.impacts).toEqual([
        { x: 530, y: 520, tags: ['touching'] },
        { x: 600, y: 600, tags: [] },
      ]);
    });
  });

  it('Ctrl + Z deshace el último impacto', async () => {
    const dataset = updatePhoto(setWithTarget(), '001.jpg', {
      calibration: {
        kind: 'ring',
        width: 1000,
        height: 1000,
        center: { x: 500, y: 500 },
        edge: { x: 750, y: 500 },
        diameterMm: 500,
      },
    });
    renderTool({ files: folderWith(dataset) });
    await openFolder();
    expect(await screen.findByRole('radio', { name: 'Agregar' })).toBeChecked();
    tapPhoto('Agregar impacto en el punto indicado', 510, 490);
    expect(screen.getByText('1 impactos marcados de 3 disparos')).toBeInTheDocument();
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(screen.getByText('0 impactos marcados de 3 disparos')).toBeInTheDocument();
  });

  it('calibra un blanco sin zonas con dos puntos y su distancia', async () => {
    const { text } = renderTool({ files: folderWith(setWithTarget(IPSC)) });
    await openFolder();
    tapPhoto('Ubicar centro en el punto indicado', 500, 500);
    tapPhoto('Ubicar punto a en el punto indicado', 200, 500);
    tapPhoto('Ubicar punto b en el punto indicado', 800, 500);
    const distance = screen.getByRole('textbox', { name: /Distancia entre A y B/ });
    await userEvent.clear(distance);
    await userEvent.type(distance, '300');
    await savedDataset(text, (saved) =>
      expect(saved.photos[0]!.calibration).toMatchObject({
        kind: 'points',
        a: { x: 200, y: 500 },
        b: { x: 800, y: 500 },
        distanceMm: 300,
      }),
    );
  });

  it('la detección actual se muestra aparte y solo se usa si se pide', async () => {
    const dataset = updatePhoto(setWithTarget(), '001.jpg', {
      calibration: {
        kind: 'ring',
        width: 1000,
        height: 1000,
        center: { x: 500, y: 500 },
        edge: { x: 750, y: 500 },
        diameterMm: 500,
      },
      impacts: [{ x: 1, y: 1, tags: ['old'] }],
    });
    const detect = vi.fn(async (): Promise<PhotoDetection> => ({
      impacts: [
        { x: 510, y: 490 },
        { x: 530, y: 520 },
      ],
      center: null,
      holeMm: 9,
    }));
    renderTool({ files: folderWith(dataset), detect });
    await openFolder();
    await userEvent.click(await screen.findByRole('button', { name: 'Ver la detección actual' }));
    expect(await screen.findByText(/propone 2 impactos/)).toBeInTheDocument();
    expect(detect).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.objectContaining({ file: '001.jpg', calibration: dataset.photos[0]!.calibration }),
      expect.objectContaining({ name: ISSF.name }),
    );
    // Lo marcado no cambia hasta usarla.
    expect(screen.getByText('1 impactos marcados de 3 disparos')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Usar como punto de partida' }));
    expect(screen.getByText('2 impactos marcados de 3 disparos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '001.jpg En progreso' })).toBeInTheDocument();
  });
});

describe('Evaluación', () => {
  /** Foto lista con dos impactos marcados, a 1 mm por px. */
  function readySet() {
    const calibrated = updatePhoto(setWithTarget(), '001.jpg', {
      calibration: {
        kind: 'ring',
        width: 1000,
        height: 1000,
        center: { x: 500, y: 500 },
        edge: { x: 750, y: 500 },
        diameterMm: 500,
      },
      impacts: [
        { x: 510, y: 490, tags: [] },
        { x: 600, y: 600, tags: ['touching'] },
      ],
      conditions: ['shadow'],
    });
    return setPhotoStatus(calibrated, '001.jpg', 'done');
  }

  it('evalúa las fotos listas, muestra el resultado, lo imprime y lo guarda', async () => {
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    // Encuentra el primero a 1 mm y detecta algo que no es un impacto; el centro, a 5 mm.
    const detect = vi.fn(async (): Promise<PhotoDetection> => ({
      impacts: [
        { x: 511, y: 490 },
        { x: 300, y: 300 },
      ],
      center: { x: 503, y: 504 },
      holeMm: 9,
    }));
    const { files } = renderTool({ files: folderWith(readySet()), detect });
    await openFolder();
    await userEvent.click(screen.getByRole('radio', { name: 'Evaluar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Evaluar 1 foto lista' }));

    const set = within(await screen.findByRole('table', { name: 'Set completo' }));
    expect(set.getByRole('row', { name: /1 fotos/ })).toHaveTextContent(
      /^1 fotos50\s?%50\s?%221,0 mm1,0 mm5,0 mm$/,
    );
    const byTag = within(screen.getByRole('table', { name: 'Por etiqueta' }));
    expect(byTag.getByRole('row', { name: /Pegado/ })).toHaveTextContent(
      /^Pegado o superpuesto0\s?%1$/,
    );
    expect(byTag.getByRole('row', { name: /Sin etiquetas/ })).toHaveTextContent(
      /^Sin etiquetas100\s?%1$/,
    );
    expect(screen.getByRole('table', { name: 'Por condición' })).toHaveTextContent('Sombra (1)');

    const saved = await screen.findByText(/^resultados\/.*\.json$/);
    const report = JSON.parse((await files.get(saved.textContent!)?.text()) ?? '{}');
    expect(report.set).toMatchObject({ truth: 2, detected: 2, matched: 1, recall: 0.5 });
    expect(report.tuning.threshold).toBe(45);
    expect(table).toHaveBeenCalled();
  });

  it('con otros parámetros corre la detección con ellos', async () => {
    vi.spyOn(console, 'table').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const detect = vi.fn(async (): Promise<PhotoDetection> => ({
      impacts: [],
      center: null,
      holeMm: 9,
    }));
    renderTool({ files: folderWith(readySet()), detect });
    await openFolder();
    await userEvent.click(screen.getByRole('radio', { name: 'Evaluar' }));
    const threshold = screen.getByRole('textbox', { name: /Umbral de brillo/ });
    await userEvent.clear(threshold);
    await userEvent.type(threshold, 'x');
    expect(screen.getByRole('button', { name: 'Evaluar 1 foto lista' })).toBeDisabled();
    await userEvent.clear(threshold);
    await userEvent.type(threshold, '60');
    await userEvent.click(screen.getByRole('button', { name: 'Evaluar 1 foto lista' }));
    await screen.findByRole('table', { name: 'Set completo' });
    expect(detect).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ threshold: 60, minFill: 0.35 }),
    );
  });
});
