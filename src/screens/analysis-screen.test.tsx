import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOUCH_DRAG_DELAY_MS } from '@/components/target-analyzer';
import type { Session } from '@/lib/sessions';
import { ANA } from '@/test/fake-auth';
import { ROUND_1, ROUND_2, TODAY, TODAY_SESSION } from '@/test/fake-sessions';
import { setDesktop } from '@/test/match-media';
import { renderSessions } from '@/test/render-sessions';
import { syntheticTarget } from '@/test/synthetic-target';

// jsdom no tiene canvas: por defecto la foto no se puede leer y la detección falla.
const { readImagePixels } = vi.hoisted(() => ({ readImagePixels: vi.fn() }));
vi.mock('@/lib/pixel-image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/pixel-image')>()),
  readImagePixels,
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TODAY);
  readImagePixels.mockReset();
  readImagePixels.mockRejectedValue(new Error('Sin canvas'));
});

afterEach(() => {
  vi.useRealTimers();
});

const DETAIL = `/sesiones/${TODAY_SESSION.id}`;
const analysisPath = (roundId: string) => `${DETAIL}/rondas/${roundId}/analisis`;

/** La ronda 2 con foto y sin analizar, sobre el ISSF o sobre un blanco sin zonas. */
function withRound2(changes: Partial<typeof ROUND_2>): Session[] {
  return [
    {
      ...TODAY_SESSION,
      rounds: [ROUND_1, { ...ROUND_2, photo: 'users/ana/rounds/r2/a.jpg', ...changes }],
    },
  ];
}

/** Simula que la foto cargó con 1000 × 1000 px y que se ve a 1000 × 1000 px de pantalla. */
async function loadPhoto(roundNumber: number) {
  const image = await screen.findByRole('img', {
    name: `Foto del blanco de la ronda ${roundNumber}`,
  });
  Object.defineProperty(image, 'naturalWidth', { value: 1000 });
  Object.defineProperty(image, 'naturalHeight', { value: 1000 });
  fireEvent.load(image);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** La superficie de la foto, que se ve a 1000 × 1000 px de pantalla. */
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

/** Toca la foto en el píxel (x, y). */
function tapPhoto(name: string | RegExp, x: number, y: number) {
  fireEvent.click(photoSurface(name), { clientX: x, clientY: y, detail: 1 });
}

/** Elige el anillo exterior del ISSF (500 mm); por defecto se propone el de 8 puntos. */
async function chooseOuterRing() {
  await userEvent.selectOptions(screen.getByRole('combobox', { name: /Anillo marcado/ }), '500');
}

/** Calibra con el anillo exterior del ISSF (500 mm) a 250 px del centro: 1 mm por px. */
async function calibrate() {
  await loadPhoto(2);
  await chooseOuterRing();
  tapPhoto('Ubicar centro en el punto indicado', 500, 500);
  tapPhoto('Ubicar anillo en el punto indicado', 750, 500);
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
}

describe('M06 · Análisis con un análisis guardado', () => {
  it('muestra el blanco, las métricas en vivo y el aviso de impactos ≠ disparos', async () => {
    renderSessions(analysisPath(ROUND_1.id));
    expect(await screen.findByRole('heading', { name: 'Análisis · Ronda 1' })).toBeInTheDocument();
    expect(screen.getByText('ISSF Pistola Precisión · 25 m · 15 disparos')).toBeInTheDocument();

    const metrics = within(screen.getByRole('region', { name: 'Métricas' }));
    expect(metrics.getByText('Puntaje').parentElement).toHaveTextContent('29 / 30');
    expect(metrics.getByRole('list', { name: 'Distribución por zona' })).toHaveTextContent(
      '10× 29× 1',
    );
    expect(metrics.getByText('Grupo').parentElement).toHaveTextContent('46,0mm≈ 6,3 MOA');
    expect(metrics.getByText('PMI').parentElement).toHaveTextContent('Hacia las 7 h');
    const mismatch = screen
      .getAllByRole('status')
      .find((item) => item.textContent?.includes('impactos marcados'));
    expect(mismatch).toHaveTextContent(
      '3 impactos marcados de 15 disparos. Tocá el blanco en modo Agregar',
    );
    expect(screen.getByRole('toolbar', { name: 'Modo de edición' })).toBeInTheDocument();
  });

  it('el PMI muestra, además del desvío y la dirección, sus coordenadas X / Y con signo', async () => {
    renderSessions(analysisPath(ROUND_1.id));
    const metrics = within(await screen.findByRole('region', { name: 'Métricas' }));
    // Impactos en (0, 10), (0, −36) y (−20, −13): PMI en (−6,7; −13,0).
    expect(metrics.getByText('PMI').parentElement).toHaveTextContent(
      'Hacia las 7 hX −6,7 · Y −13,0',
    );
  });

  it('en desktop, las coordenadas del PMI llevan la unidad', async () => {
    setDesktop(true);
    renderSessions(analysisPath(ROUND_1.id));
    const metrics = within(await screen.findByRole('region', { name: 'Métricas' }));
    expect(metrics.getByText('Desvío PMI').parentElement).toHaveTextContent(
      'X −6,7 mm · Y −13,0 mm',
    );
  });

  it('con el puntaje calculado marcado, la ronda usa el calculado', async () => {
    const { sessions, sessionItems } = renderSessions(analysisPath(ROUND_1.id));
    const checkbox = await screen.findByRole('checkbox', {
      name: /Usar el puntaje calculado \(29\) en la ronda\. Puntaje cargado: 136\./,
    });
    // El análisis guardado no lo había confirmado.
    expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar análisis' }));

    expect(sessions.saveAnalysis).toHaveBeenCalledWith(
      ANA.uid,
      TODAY_SESSION.id,
      ROUND_1.id,
      expect.objectContaining({
        score: 29,
        analysis: expect.objectContaining({ scoreConfirmed: true }),
      }),
    );
    const round = sessionItems()[0]!.rounds[0]!;
    expect(round).toMatchObject({ score: 29, manualScore: 136 });
    // Vuelve al detalle de la sesión.
    expect(await screen.findByRole('heading', { name: 'Rondas · 2' })).toBeInTheDocument();
    expect(await screen.findByText('Análisis guardado')).toBeInTheDocument();
  });

  it('con el puntaje calculado desmarcado, la ronda conserva el cargado a mano', async () => {
    const { sessions, sessionItems } = renderSessions(analysisPath(ROUND_1.id));
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Quitar impacto 3, zona 10' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar análisis' }));

    expect(sessions.saveAnalysis).toHaveBeenCalledWith(
      ANA.uid,
      TODAY_SESSION.id,
      ROUND_1.id,
      expect.objectContaining({
        score: null,
        analysis: expect.objectContaining({
          scoreConfirmed: false,
          impacts: [
            { x: 0, y: 10 },
            { x: 0, y: -36 },
          ],
          metrics: expect.objectContaining({ impacts: 2, score: 19, groupSizeMm: 46 }),
        }),
      }),
    );
    expect(sessionItems()[0]!.rounds[0]).toMatchObject({ score: null, manualScore: 136 });
  });

  it('en desktop lista los impactos; se pueden quitar desde la tabla y deshacer', async () => {
    setDesktop(true);
    renderSessions(analysisPath(ROUND_1.id));
    const table = await screen.findByRole('table', { name: 'Impactos' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[2]).toHaveTextContent('290,0-36,0');
    expect(screen.getByRole('heading', { name: 'Impactos (3)' })).toBeInTheDocument();

    await userEvent.click(within(table).getByRole('button', { name: 'Quitar impacto 1' }));
    expect(screen.getByRole('heading', { name: 'Impactos (2)' })).toBeInTheDocument();
    expect(screen.getByText('Puntaje').parentElement).toHaveTextContent('19 / 20');

    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.getByRole('heading', { name: 'Impactos (3)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeDisabled();
  });

  it('el zoom es dentro de la foto: botones, y con la foto ampliada se desplaza sin marcar', async () => {
    renderSessions(analysisPath(ROUND_1.id));
    await screen.findByRole('heading', { name: 'Análisis · Ronda 1' });
    const photo = await screen.findByRole('img', { name: 'Foto del blanco de la ronda 1' });
    const content = photo.parentElement!;
    const viewer = screen.getByRole('group', { name: 'Visor de la foto' });

    // El recuadro es 5:6 en el celular. La foto (cuadrada) arranca cubriéndolo, centrada: a 1,2×
    // de la foto entera, con un 10 % de cada costado afuera.
    expect(viewer).toHaveStyle({ aspectRatio: String(5 / 6) });
    expect(content).toHaveStyle({ transform: 'translate(-10%, 0%) scale(1.2)' });

    // Entera: ocupa todo el ancho y 5/6 del alto, centrada.
    await userEvent.click(screen.getByRole('button', { name: 'Ver la foto entera' }));
    expect(content).toHaveStyle({ transform: 'translate(0%, 10%) scale(1)' });
    expect(screen.getByRole('button', { name: 'Alejar' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Ver la foto entera' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Acercar' }));
    expect(content).toHaveStyle({ transform: 'translate(-50%, -40%) scale(2)' });

    // Con la foto ampliada, arrastrar la desplaza y no agrega un impacto.
    vi.spyOn(viewer, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 1000,
      height: 1000,
    } as DOMRect);
    const surface = screen.getByRole('button', { name: 'Agregar impacto en el punto indicado' });
    const mouse = { button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    fireEvent.pointerDown(surface, { ...mouse, clientX: 500, clientY: 500 });
    fireEvent.pointerMove(surface, { ...mouse, clientX: 600, clientY: 450 });
    fireEvent.pointerUp(surface, { ...mouse, clientX: 600, clientY: 450 });
    fireEvent.click(surface, { clientX: 600, clientY: 450, detail: 1 });
    expect(content).toHaveStyle({ transform: 'translate(-40%, -46%) scale(2)' });
    expect(
      screen.getAllByRole('status').find((item) => item.textContent?.includes('impactos marcados')),
    ).toHaveTextContent('3 impactos marcados');

    await userEvent.click(screen.getByRole('button', { name: 'Ver la foto entera' }));
    expect(content).toHaveStyle({ transform: 'translate(0%, 10%) scale(1)' });
  });

  it('salir con cambios sin guardar pide confirmación', async () => {
    const { router } = renderSessions(analysisPath(ROUND_1.id));
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Quitar impacto 1, zona 10' }));
    await userEvent.click(screen.getByRole('button', { name: 'Volver a la sesión' }));

    const dialog = await screen.findByRole('alertdialog', { name: '¿Descartar el análisis?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Seguir editando' }));
    expect(router.state.location.pathname).toBe(analysisPath(ROUND_1.id));

    await userEvent.click(screen.getByRole('button', { name: 'Volver a la sesión' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(DETAIL));
  });
});

describe('M06 · Análisis nuevo', () => {
  it('se entra desde la ronda en el detalle de la sesión, arriba de todo', async () => {
    const { router } = renderSessions(DETAIL, { sessions: withRound2({}) });
    await userEvent.click(
      await screen.findByRole('link', { name: 'Analizar blanco de la ronda 2' }),
    );
    expect(router.state.location.pathname).toBe(analysisPath(ROUND_2.id));
    expect(await screen.findByRole('heading', { name: 'Calibrar la foto' })).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('calibra con un anillo, marca impactos y propone el puntaje calculado, ya marcado', async () => {
    const { sessions } = renderSessions(analysisPath(ROUND_2.id), { sessions: withRound2({}) });
    expect(await screen.findByRole('combobox', { name: /Anillo marcado/ })).toHaveDisplayValue(
      '8 puntos · Ø 150 mm',
    );
    await calibrate();

    // La detección automática no puede leer la foto en el entorno de test: se marca a mano.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudieron detectar los impactos',
    );
    tapPhoto('Agregar impacto en el punto indicado', 500, 490); // (0, 10) mm: 10
    tapPhoto('Agregar impacto en el punto indicado', 500, 536); // (0, −36) mm: 9

    const checkbox = screen.getByRole('checkbox', {
      name: /Usar el puntaje calculado \(19\) en la ronda\. Puntaje cargado: 131\./,
    });
    expect(checkbox).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar análisis' }));

    expect(sessions.saveAnalysis).toHaveBeenCalledWith(
      ANA.uid,
      TODAY_SESSION.id,
      ROUND_2.id,
      expect.objectContaining({
        score: 19,
        analysis: expect.objectContaining({
          calibration: expect.objectContaining({ kind: 'ring', diameterMm: 500 }),
          impacts: [
            { x: 0, y: 10 },
            { x: 0, y: -36 },
          ],
          scoreConfirmed: true,
        }),
      }),
    );
  });

  it('ubica solo el centro de los anillos y el usuario completa la calibración', async () => {
    // La foto de 1000 px se lee reducida a 400 px (escala 0,4), con el centro en (220, 180).
    readImagePixels.mockResolvedValueOnce(
      syntheticTarget({ width: 400, center: { x: 220, y: 180 } })
        .blackDisk(40)
        .ringLine(70)
        .ringLine(100)
        .image(),
    );
    const { sessions } = renderSessions(analysisPath(ROUND_2.id), { sessions: withRound2({}) });
    await loadPhoto(2);

    expect(await screen.findByText(/El centro se ubicó automáticamente/)).toBeInTheDocument();
    expect(readImagePixels).toHaveBeenCalledWith(expect.any(Blob), 0.4);
    expect(screen.getByRole('radio', { name: 'Centro ✓' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Anillo' })).toBeChecked();

    // El centro de la foto original es (551,25; 451,25): el anillo de 500 mm, a 250 px.
    await chooseOuterRing();
    tapPhoto('Ubicar anillo en el punto indicado', 801.25, 451.25);
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    tapPhoto('Agregar impacto en el punto indicado', 551.25, 441.25);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar análisis' }));

    expect(sessions.saveAnalysis).toHaveBeenCalledWith(
      ANA.uid,
      TODAY_SESSION.id,
      ROUND_2.id,
      expect.objectContaining({
        analysis: expect.objectContaining({
          calibration: expect.objectContaining({
            center: { x: expect.closeTo(551.25, 0), y: expect.closeTo(451.25, 0) },
          }),
        }),
      }),
    );
  });

  it('el centro ubicado solo se corrige tocando la foto y no cuenta como cambio', async () => {
    readImagePixels.mockResolvedValueOnce(
      syntheticTarget({ width: 400 }).blackDisk(40).ringLine(70).image(),
    );
    const { router } = renderSessions(analysisPath(ROUND_2.id), { sessions: withRound2({}) });
    await loadPhoto(2);
    await screen.findByText(/El centro se ubicó automáticamente/);

    // Salir sin haber tocado nada no pide confirmación.
    await userEvent.click(screen.getByRole('button', { name: 'Volver a la sesión' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(DETAIL));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('si no encuentra el centro, se ubica a mano', async () => {
    readImagePixels.mockResolvedValueOnce(syntheticTarget({ width: 400 }).image());
    renderSessions(analysisPath(ROUND_2.id), { sessions: withRound2({}) });
    await loadPhoto(2);
    await waitFor(() => expect(readImagePixels).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Buscando el centro…')).not.toBeInTheDocument());
    expect(screen.getByRole('radio', { name: 'Centro' })).toBeChecked();
    expect(screen.queryByText(/El centro se ubicó automáticamente/)).not.toBeInTheDocument();

    tapPhoto('Ubicar centro en el punto indicado', 500, 500);
    expect(screen.getByRole('radio', { name: 'Anillo' })).toBeChecked();
  });

  it('al mantener apretado, el marcador sigue al dedo y se fija al soltar', async () => {
    const { sessions } = renderSessions(analysisPath(ROUND_2.id), { sessions: withRound2({}) });
    await loadPhoto(2);

    const center = photoSurface('Ubicar centro en el punto indicado');
    fireEvent.pointerDown(center, { clientX: 400, clientY: 420, button: 0, pointerId: 1 });
    // El centro ya está ubicado pero sigue activo mientras no se suelte.
    expect(screen.getByRole('radio', { name: 'Centro ✓' })).toBeChecked();
    fireEvent.pointerMove(center, { clientX: 480, clientY: 490, pointerId: 1 });
    expect(screen.getByRole('radio', { name: 'Centro ✓' })).toBeChecked();
    fireEvent.pointerUp(center, { clientX: 500, clientY: 500, pointerId: 1 });
    // El click que sigue al soltar no ubica el anillo en el mismo lugar.
    fireEvent.click(center, { clientX: 500, clientY: 500, detail: 1 });
    expect(screen.getByRole('radio', { name: 'Anillo' })).toBeChecked();

    // Fuera de la foto, el punto queda en el borde.
    await chooseOuterRing();
    const edge = photoSurface('Ubicar anillo en el punto indicado');
    fireEvent.pointerDown(edge, { clientX: 700, clientY: 500, button: 0, pointerId: 1 });
    fireEvent.pointerMove(edge, { clientX: 1200, clientY: 500, pointerId: 1 });
    fireEvent.pointerMove(edge, { clientX: 750, clientY: 500, pointerId: 1 });
    fireEvent.pointerUp(edge, { clientX: 750, clientY: 500, pointerId: 1 });
    fireEvent.click(edge, { clientX: 750, clientY: 500, detail: 1 });
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    tapPhoto('Agregar impacto en el punto indicado', 500, 490);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar análisis' }));
    expect(sessions.saveAnalysis).toHaveBeenCalledWith(
      ANA.uid,
      TODAY_SESSION.id,
      ROUND_2.id,
      expect.objectContaining({
        analysis: expect.objectContaining({
          calibration: expect.objectContaining({
            center: { x: 500, y: 500 },
            edge: { x: 750, y: 500 },
          }),
          impacts: [{ x: 0, y: 10 }],
        }),
      }),
    );
  });

  it('con el dedo, un toque corto ubica el punto y dos dedos (zoom) no lo mueven', async () => {
    renderSessions(analysisPath(ROUND_2.id), { sessions: withRound2({}) });
    await loadPhoto(2);
    const surface = photoSurface('Ubicar centro en el punto indicado');
    const touch = (id: number, x: number, y: number) => ({
      clientX: x,
      clientY: y,
      button: 0,
      pointerId: id,
      pointerType: 'touch',
      isPrimary: id === 1,
    });

    // Zoom: el segundo dedo llega antes de que empiece el arrastre.
    fireEvent.pointerDown(surface, touch(1, 400, 400));
    fireEvent.pointerDown(surface, touch(2, 600, 600));
    await wait(TOUCH_DRAG_DELAY_MS + 50);
    fireEvent.pointerMove(surface, touch(1, 300, 300));
    fireEvent.pointerUp(surface, touch(2, 650, 650));
    fireEvent.pointerUp(surface, touch(1, 300, 300));
    fireEvent.click(surface, { clientX: 300, clientY: 300, detail: 1 });
    expect(screen.getByRole('radio', { name: 'Centro' })).toBeChecked();

    // Toque corto: ubica el centro y pasa al anillo.
    fireEvent.pointerDown(surface, touch(1, 500, 500));
    fireEvent.pointerUp(surface, touch(1, 500, 500));
    fireEvent.click(surface, { clientX: 500, clientY: 500, detail: 1 });
    expect(screen.getByRole('radio', { name: 'Anillo' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Centro ✓' })).toBeInTheDocument();

    // Arrastre ya empezado y un segundo dedo tarde: el anillo vuelve a no estar ubicado.
    const edge = photoSurface('Ubicar anillo en el punto indicado');
    fireEvent.pointerDown(edge, touch(1, 700, 500));
    expect(await screen.findByRole('radio', { name: 'Anillo ✓' })).toBeChecked();
    fireEvent.pointerDown(edge, touch(2, 800, 600));
    expect(screen.getByRole('radio', { name: 'Anillo' })).toBeChecked();
    fireEvent.pointerCancel(edge, touch(1, 700, 500));
    fireEvent.pointerCancel(edge, touch(2, 800, 600));

    // Si el navegador toma el gesto (pointercancel), también vuelve atrás.
    fireEvent.pointerDown(edge, touch(1, 700, 500));
    expect(await screen.findByRole('radio', { name: 'Anillo ✓' })).toBeChecked();
    fireEvent.pointerCancel(edge, touch(1, 700, 500));
    expect(screen.getByRole('radio', { name: 'Anillo' })).toBeChecked();
  });

  it('al calibrar, dos dedos acercan la foto sin ubicar el marcador', async () => {
    renderSessions(analysisPath(ROUND_2.id), { sessions: withRound2({}) });
    await loadPhoto(2);
    const viewer = screen.getByRole('group', { name: 'Visor de la foto' });
    vi.spyOn(viewer, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 1000,
      height: 1000,
    } as DOMRect);
    const surface = photoSurface('Ubicar centro en el punto indicado');
    const touch = (id: number, x: number) => ({
      clientX: x,
      clientY: 500,
      button: 0,
      pointerId: id,
      pointerType: 'touch',
      isPrimary: id === 1,
    });
    fireEvent.pointerDown(surface, touch(1, 400));
    fireEvent.pointerDown(surface, touch(2, 600));
    // Los dedos se separan al doble, con el punto medio en el mismo lugar.
    fireEvent.pointerMove(surface, touch(1, 300));
    fireEvent.pointerMove(surface, touch(2, 700));
    fireEvent.pointerUp(surface, touch(1, 300));
    fireEvent.pointerUp(surface, touch(2, 700));
    fireEvent.click(surface, { clientX: 700, clientY: 500, detail: 1 });

    const content = screen.getByRole('img', {
      name: 'Foto del blanco de la ronda 2',
    }).parentElement!;
    // De 1,2× a 2,4×, con el centro de la foto quieto entre los dedos.
    expect(content).toHaveStyle({ transform: 'translate(-70%, -60%) scale(2.4)' });
    expect(screen.getByRole('radio', { name: 'Centro' })).toBeChecked();
  });

  it('lo que se ajusta se elige sobre la foto, también para corregir uno ya ubicado', async () => {
    renderSessions(analysisPath(ROUND_2.id), { sessions: withRound2({}) });
    await loadPhoto(2);
    const viewer = screen.getByRole('group', { name: 'Visor de la foto' });
    const picker = within(viewer).getByRole('radiogroup', { name: 'Qué ajustar' });
    const panel = screen.getByRole('region', { name: 'Calibrar la foto' });
    expect(within(panel).queryByRole('radiogroup')).not.toBeInTheDocument();

    tapPhoto('Ubicar centro en el punto indicado', 480, 480);
    expect(within(picker).getByRole('radio', { name: 'Anillo' })).toBeChecked();
    await userEvent.click(within(picker).getByRole('radio', { name: 'Centro ✓' }));
    expect(within(panel).getByRole('status')).toHaveTextContent('Tocá el centro del blanco.');
    tapPhoto('Ubicar centro en el punto indicado', 500, 500);
    // Con el anillo todavía sin ubicar, pasa a él.
    expect(within(picker).getByRole('radio', { name: 'Anillo' })).toBeChecked();
  });

  it('con "Forma" se deforman los anillos y las medidas los siguen', async () => {
    const { sessions } = renderSessions(analysisPath(ROUND_2.id), { sessions: withRound2({}) });
    await loadPhoto(2);
    const picker = within(screen.getByRole('group', { name: 'Visor de la foto' })).getByRole(
      'radiogroup',
      { name: 'Qué ajustar' },
    );

    // Sin el centro y el anillo, todavía no se puede deformar.
    await userEvent.click(within(picker).getByRole('radio', { name: 'Forma' }));
    tapPhoto('Deformar los anillos hacia el punto indicado', 500, 400);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ubicá el centro y un punto sobre un anillo antes de deformarlos',
    );

    // El anillo de 500 mm, 250 px a la derecha del centro: 1 mm por px.
    await chooseOuterRing();
    await userEvent.click(within(picker).getByRole('radio', { name: 'Centro' }));
    tapPhoto('Ubicar centro en el punto indicado', 500, 500);
    tapPhoto('Ubicar anillo en el punto indicado', 750, 500);

    // La foto se sacó desde abajo: los anillos se ven achatados. Se arrastra hacia arriba hasta
    // que el anillo de 500 mm mide 100 px de alto.
    await userEvent.click(within(picker).getByRole('radio', { name: 'Forma' }));
    const surface = photoSurface('Deformar los anillos hacia el punto indicado');
    const mouse = { button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    fireEvent.pointerDown(surface, { ...mouse, clientX: 500, clientY: 300 });
    fireEvent.pointerMove(surface, { ...mouse, clientX: 500, clientY: 350 });
    fireEvent.pointerUp(surface, { ...mouse, clientX: 500, clientY: 400 });
    fireEvent.click(surface, { clientX: 500, clientY: 400, detail: 1 });
    expect(within(picker).getByRole('radio', { name: 'Forma ✓' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Volver a círculos' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    // 40 px hacia arriba son 100 mm; 100 px a la derecha, 100 mm.
    tapPhoto('Agregar impacto en el punto indicado', 500, 460);
    tapPhoto('Agregar impacto en el punto indicado', 600, 500);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar análisis' }));
    const result = vi.mocked(sessions.saveAnalysis).mock.calls[0]![3];
    expect(result.analysis.calibration).toMatchObject({
      kind: 'ring',
      shape: { angle: expect.closeTo(-Math.PI / 2), ratio: expect.closeTo(2.5) },
    });
    const [first, second] = result.analysis.impacts;
    expect(first!.x).toBeCloseTo(0);
    expect(first!.y).toBeCloseTo(100);
    expect(second!.x).toBeCloseTo(100);
    expect(second!.y).toBeCloseTo(0);
  });

  it('"Volver a círculos" deshace la deformación', async () => {
    renderSessions(analysisPath(ROUND_2.id), { sessions: withRound2({}) });
    await loadPhoto(2);
    tapPhoto('Ubicar centro en el punto indicado', 500, 500);
    tapPhoto('Ubicar anillo en el punto indicado', 750, 500);
    await userEvent.click(screen.getByRole('radio', { name: 'Forma' }));
    tapPhoto('Deformar los anillos hacia el punto indicado', 500, 400);
    expect(screen.getByRole('radio', { name: 'Forma ✓' })).toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: 'Volver a círculos' }));
    expect(screen.getByRole('radio', { name: 'Forma' })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Volver a círculos' })).not.toBeInTheDocument();
  });

  it('no deja continuar sin ubicar el punto sobre el anillo', async () => {
    renderSessions(analysisPath(ROUND_2.id), { sessions: withRound2({}) });
    await loadPhoto(2);
    tapPhoto('Ubicar centro en el punto indicado', 500, 500);
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Tocá un punto sobre un anillo');
    expect(screen.getByRole('heading', { name: 'Calibrar la foto' })).toBeInTheDocument();
  });

  it('no guarda un análisis sin impactos', async () => {
    const { sessions } = renderSessions(analysisPath(ROUND_2.id), { sessions: withRound2({}) });
    await calibrate();
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar análisis' }));
    expect(
      await screen.findByText('Marcá al menos un impacto para guardar el análisis'),
    ).toBeInTheDocument();
    expect(sessions.saveAnalysis).not.toHaveBeenCalled();
  });

  it('en un blanco sin zonas calibra con dos puntos y conserva el puntaje manual', async () => {
    const { sessions } = renderSessions(analysisPath(ROUND_2.id), {
      sessions: withRound2({ targetId: 'ipsc-classic' }),
    });
    expect(await screen.findByRole('textbox', { name: /Distancia entre A y B/ })).toHaveValue(
      '460',
    );
    await loadPhoto(2);
    tapPhoto('Ubicar centro en el punto indicado', 500, 500);
    tapPhoto('Ubicar punto a en el punto indicado', 270, 500);
    tapPhoto('Ubicar punto b en el punto indicado', 730, 500);
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    tapPhoto('Agregar impacto en el punto indicado', 520, 500);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(
      screen.getByText('Este blanco no tiene zonas: el puntaje de la ronda es el cargado a mano.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar análisis' }));
    expect(sessions.saveAnalysis).toHaveBeenCalledWith(
      ANA.uid,
      TODAY_SESSION.id,
      ROUND_2.id,
      expect.objectContaining({
        score: null,
        analysis: expect.objectContaining({
          impacts: [{ x: 20, y: 0 }],
          metrics: expect.objectContaining({ score: null, meanDistanceMm: 20 }),
        }),
      }),
    );
  });

  it('sin foto, ofrece agregarla desde la edición de la ronda', async () => {
    renderSessions(analysisPath(ROUND_2.id));
    expect(
      await screen.findByRole('heading', { name: 'Esta ronda no tiene foto' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Agregar foto' })).toHaveAttribute(
      'href',
      `${DETAIL}/rondas/${ROUND_2.id}/editar`,
    );
    expect(screen.queryByRole('button', { name: 'Guardar análisis' })).not.toBeInTheDocument();
  });
});
