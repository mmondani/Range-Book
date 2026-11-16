import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { formatTime, isoDate } from '@/lib/format';
import type { Round, Session } from '@/lib/sessions';
import { ROUND_2, TODAY_SESSION } from '@/test/fake-sessions';
import { mantisExport, MANTIS_EXPORT } from '@/test/mantis-fixture';
import { setDesktop } from '@/test/match-media';
import { renderSessions } from '@/test/render-sessions';
import { parseMantisFile } from '@/lib/mantis-import';

const PATH = '/sesiones/importar-mantisx';

// Las sesiones de MantisX del fixture: 13:07, 13:09 y 14:04 UTC del 15/11/2026.
const FIRST = '2026-11-15T13:07:36Z';
const SECOND = '2026-11-15T13:09:57Z';
const THIRD = '2026-11-15T14:04:04Z';

const round = (id: string, createdAt: string | null, shots = 5): Round => ({
  ...ROUND_2,
  id,
  shots,
  manualScore: null,
  createdAt,
  mantis: null,
});

/** Sesión del día de las sesiones de MantisX (en la zona horaria de los tests). */
const MANTIS_DAY: Session = {
  ...TODAY_SESSION,
  id: 'mantis-dia',
  date: isoDate(new Date(FIRST)),
  configurationId: null,
  modificationsSnapshot: [],
  photos: [],
  rounds: [
    round('m1', '2026-11-15T13:08:10Z'),
    round('m2', '2026-11-15T13:11:00Z', 10),
    round('m3', '2026-11-15T14:05:00Z'),
  ],
};

function exportFile(data: unknown = MANTIS_EXPORT, name = 'mantisx-2026-11-15.json') {
  return new File([JSON.stringify(data)], name, { type: 'application/json' });
}

async function chooseFile(user: ReturnType<typeof userEvent.setup>, file = exportFile()) {
  await screen.findByRole('heading', { name: 'Elegí el archivo exportado' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Elegir archivo' })).toBeEnabled());
  await user.upload(screen.getByLabelText('Archivo exportado de MantisX'), file);
}

const roundSelect = (time: string) =>
  screen.getByRole('combobox', { name: `Ronda para la sesión de MantisX de las ${time}` });

afterEach(() => {
  setDesktop(false);
});

describe('MantisImportScreen', () => {
  it('propone una ronda para cada sesión de MantisX por la hora y las importa', async () => {
    const user = userEvent.setup();
    const view = renderSessions(PATH, { sessions: [MANTIS_DAY, TODAY_SESSION] });
    await chooseFile(user);

    expect(
      await screen.findByRole('heading', { name: 'Revisá la importación' }),
    ).toBeInTheDocument();
    expect(screen.getByText('mantisx-2026-11-15.json')).toBeInTheDocument();
    const group = screen.getByRole('region', { name: 'Glock 17 Gen5 · Stock' });
    expect(group).toHaveTextContent('Polígono Norte · 3 rondas');

    const selects = within(group).getAllByRole('combobox', { name: 'Ronda' });
    expect(selects.map((select) => (select as HTMLSelectElement).value)).toEqual([
      'm1',
      'm2',
      'm3',
    ]);
    expect(group).toHaveTextContent(`MantisX ${formatTime(FIRST)}5 disparos · 93,9`);
    expect(group).toHaveTextContent(`MantisX ${formatTime(SECOND)}4 disparos · 88,5`);
    // Las opciones: con la hora de la ronda y sin las elegidas en las otras filas.
    expect(
      within(selects[0]!)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([`Ronda 1 · ${formatTime('2026-11-15T13:08:10Z')} · 5 disparos`, 'No importar']);
    // Aviso si los disparos no coinciden, asociado al select.
    expect(selects[1]).toHaveAccessibleDescription(
      'La ronda 2 tiene 10 disparos y MantisX registró 4.',
    );

    await user.click(screen.getByRole('button', { name: 'Importar 3 rondas' }));

    expect(await screen.findByText('Se importaron 3 rondas de MantisX')).toBeInTheDocument();
    expect(view.router.state.location.pathname).toBe('/sesiones');
    const rounds = view.sessionItems().find((item) => item.id === 'mantis-dia')!.rounds;
    expect(rounds.map((item) => item.mantis?.sessionPk)).toEqual([36042015, 36042043, 36042499]);
    expect(rounds[2]!.mantis).toMatchObject({ hardware: 'X10', rightHanded: false });
    expect([...view.traceItems().keys()].sort()).toEqual([36042015, 36042043, 36042499]);
    expect(view.traceItems().get(36042499)!.shots).toHaveLength(5);
  });

  it('permite cambiar la ronda o no importar una sesión de MantisX', async () => {
    const user = userEvent.setup();
    const view = renderSessions(PATH, { sessions: [MANTIS_DAY] });
    await chooseFile(user);
    const [first, second] = await screen.findAllByRole('combobox', { name: 'Ronda' });

    // La ronda 2 está elegida en la segunda fila: no aparece en la primera hasta que se libera.
    expect(within(first!).queryByRole('option', { name: /^Ronda 2/ })).not.toBeInTheDocument();
    await user.selectOptions(second!, '');
    await user.selectOptions(first!, 'm2');
    expect(first).toHaveValue('m2');
    await user.selectOptions(second!, 'm1');
    await user.selectOptions(screen.getAllByRole('combobox', { name: 'Ronda' })[2]!, '');
    await user.click(screen.getByRole('button', { name: 'Importar 2 rondas' }));

    await screen.findByText('Se importaron 2 rondas de MantisX');
    const rounds = view.sessionItems()[0]!.rounds;
    expect(rounds.map((item) => item.mantis?.sessionPk ?? null)).toEqual([
      36042043,
      36042015,
      null,
    ]);
  });

  it('al reimportar, las ya importadas no se vuelven a importar', async () => {
    const result = parseMantisFile(JSON.stringify(MANTIS_EXPORT));
    if (!result.ok) throw new Error(result.error);
    const imported: Session = {
      ...MANTIS_DAY,
      rounds: [
        { ...MANTIS_DAY.rounds[0]!, mantis: result.file.sessions[0]!.summary },
        ...MANTIS_DAY.rounds.slice(1),
      ],
    };
    const user = userEvent.setup();
    renderSessions(PATH, { sessions: [imported] });
    await chooseFile(user);

    expect(await screen.findByText('Ya importadas')).toBeInTheDocument();
    expect(screen.getByText(/En la ronda 1 de la sesión del 15\/11/)).toBeInTheDocument();
    const selects = screen.getAllByRole('combobox', { name: 'Ronda' });
    expect(selects.map((select) => (select as HTMLSelectElement).value)).toEqual(['m2', 'm3']);
    expect(screen.getByRole('button', { name: 'Importar 2 rondas' })).toBeEnabled();
  });

  it('indica lo que no se importa y por qué', async () => {
    const data = mantisExport();
    data.sessions.push(
      { ...data.sessions[0]!, pk: 1, fire_type: 0 },
      { ...data.sessions[0]!, pk: 2, drill_id: 7, drill_name: 'Holster Draw Analysis' },
    );
    const user = userEvent.setup();
    // Solo dos rondas para tres sesiones de MantisX.
    renderSessions(PATH, {
      sessions: [{ ...MANTIS_DAY, rounds: MANTIS_DAY.rounds.slice(0, 2) }],
    });
    await chooseFile(user, exportFile(data));

    const skipped = await screen.findByRole('region', { name: /No se importan/ });
    expect(skipped).toHaveTextContent('No se importan 1');
    expect(skipped).toHaveTextContent('No queda ninguna ronda disponible en esa sesión.');
    expect(
      screen.getByText(
        'Se omitieron 2 sesiones de otros entrenamientos (tiro en seco y Holster Draw Analysis): por ahora solo se importa fuego real de «Open Training».',
      ),
    ).toBeInTheDocument();
  });

  it('sin sesión de Range Book ese día no hay nada para importar', async () => {
    const user = userEvent.setup();
    renderSessions(PATH, { sessions: [TODAY_SESSION] });
    await chooseFile(user);

    expect(
      await screen.findByRole('heading', { name: 'No hay nada nuevo para importar' }),
    ).toBeInTheDocument();
    const day = isoDate(new Date(FIRST)).split('-');
    expect(
      screen.getAllByText(`No hay ninguna sesión de Range Book el ${day[2]}/${day[1]}.`),
    ).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /^Importar/ })).not.toBeInTheDocument();
  });

  it('avisa si el archivo no sirve', async () => {
    const user = userEvent.setup();
    renderSessions(PATH, { sessions: [MANTIS_DAY] });
    await chooseFile(user, exportFile({ sessions: [] }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El archivo no es un export de MantisX',
    );

    await user.upload(
      screen.getByLabelText('Archivo exportado de MantisX'),
      exportFile({ ...MANTIS_EXPORT, formatVersion: 2 }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este archivo es de una versión más nueva del marcador: actualizá Range Book',
    );
  });

  it('salir con una revisión sin importar pide confirmación', async () => {
    const user = userEvent.setup();
    const view = renderSessions(PATH, { sessions: [MANTIS_DAY] });
    await chooseFile(user);
    await screen.findByRole('heading', { name: 'Revisá la importación' });

    // "Cambiar archivo" vuelve a la primera etapa, sin salir.
    await user.click(screen.getByRole('button', { name: 'Cambiar archivo' }));
    expect(screen.getByRole('heading', { name: 'Importar MantisX' })).toBeInTheDocument();
    await chooseFile(user);
    await screen.findByRole('heading', { name: 'Revisá la importación' });

    await view.router.navigate('/sesiones');
    const dialog = await screen.findByRole('alertdialog', { name: '¿Descartar la importación?' });
    await user.click(within(dialog).getByRole('button', { name: 'Seguir revisando' }));
    expect(view.router.state.location.pathname).toBe(PATH);

    await view.router.navigate('/sesiones');
    await user.click(await screen.findByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/sesiones'));
  });

  it('copia el marcador para exportar desde MantisX', async () => {
    const user = userEvent.setup();
    renderSessions(PATH, { sessions: [MANTIS_DAY] });
    // Nunca se importó: la ayuda está abierta.
    const copy = await screen.findByRole('button', { name: 'Copiar el marcador' });
    expect(copy).toBeVisible();
    await user.click(copy);
    expect(await screen.findByRole('button', { name: 'Marcador copiado' })).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toMatch(/^javascript:/);
  });

  it('en desktop muestra el matching en una tabla y el archivo al costado', async () => {
    setDesktop(true);
    const user = userEvent.setup();
    renderSessions(PATH, { sessions: [MANTIS_DAY] });
    await chooseFile(user);

    expect(await screen.findByRole('navigation', { name: 'Ruta' })).toHaveTextContent(
      'SesionesImportar MantisX',
    );
    expect(roundSelect(formatTime(THIRD))).toHaveValue('m3');
    const aside = screen.getByRole('complementary', { name: 'Archivo' });
    expect(aside).toHaveTextContent('3 sesiones de MantisX');
    expect(screen.getByRole('button', { name: 'Importar 3 rondas' })).toBeInTheDocument();
  });

  it('se llega desde el encabezado de Sesiones', async () => {
    const user = userEvent.setup();
    const view = renderSessions('/sesiones', { sessions: [MANTIS_DAY] });
    await user.click(await screen.findByRole('link', { name: 'Importar MantisX' }));
    expect(view.router.state.location.pathname).toBe(PATH);
  });
});
