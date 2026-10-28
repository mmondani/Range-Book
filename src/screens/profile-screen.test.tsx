import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/components/auth-provider';
import { ProfileProvider } from '@/components/profile-provider';
import { ToastProvider } from '@/components/toast-provider';
import { THEME_STORAGE_KEY } from '@/lib/theme';
import { routes } from '@/routes';
import { ANA, createFakeAuth, type FakeAuthOptions } from '@/test/fake-auth';
import { setSystemPrefersLight } from '@/test/match-media';

type Fake = ReturnType<typeof createFakeAuth>;

function renderProfile(options?: FakeAuthOptions, configure?: (fake: Fake) => void) {
  const fake = createFakeAuth({ initialUser: ANA, ...options });
  configure?.(fake);
  const router = createMemoryRouter(routes, { initialEntries: ['/perfil'] });
  const view = render(
    <AuthProvider auth={fake.auth} profiles={fake.profiles}>
      <ProfileProvider repository={fake.profiles}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ProfileProvider>
    </AuthProvider>,
  );
  return { ...fake, router, view };
}

const theme = () => document.documentElement.getAttribute('data-theme');

/** Simula el `beforeinstallprompt` de Chrome; `prompt` resuelve como si se aceptara. */
function offerInstall() {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome: 'accepted' as const }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const radio = (group: string, name: string) =>
  within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name });

describe('ProfileScreen', () => {
  afterEach(() => {
    // Olvida el `beforeinstallprompt` que haya quedado guardado.
    window.dispatchEvent(new Event('appinstalled'));
    vi.restoreAllMocks();
  });

  it('muestra la cuenta, el resumen con formato es-AR y la versión', async () => {
    renderProfile({ summary: { sessions: 48, shots: 10552, firearms: 3 } });

    expect(await screen.findByRole('heading', { level: 1, name: 'Perfil' })).toBeInTheDocument();
    const account = screen.getByRole('region', { name: 'Cuenta' });
    expect(account).toHaveTextContent('Ana Gómez');
    expect(account).toHaveTextContent('ana@example.com');
    expect(account).toHaveTextContent('AG');

    const summary = screen.getByRole('region', { name: 'Resumen' });
    await waitFor(() => expect(summary).toHaveTextContent(/Sesiones\s*48/));
    expect(summary).toHaveTextContent(/Disparos\s*10\.552/);
    expect(summary).toHaveTextContent(/Armas\s*3/);

    expect(screen.getByText('Versión').parentElement).toHaveTextContent(__APP_VERSION__);
  });

  it('si no se puede leer el resumen, muestra guiones', async () => {
    renderProfile(undefined, ({ profiles }) =>
      profiles.subscribeSummary.mockImplementation((_uid, _onSummary, onError) => {
        onError(new Error('sin permiso'));
        return () => undefined;
      }),
    );
    const summary = await screen.findByRole('region', { name: 'Resumen' });
    await waitFor(() => expect(summary).toHaveTextContent(/Sesiones\s*—/));
  });

  it('las unidades empiezan en milímetros y se guardan en el perfil al cambiarlas', async () => {
    const { profiles } = renderProfile();
    expect(await screen.findByRole('radio', { name: 'Milímetros' })).toBeChecked();

    await userEvent.click(radio('Unidades de medida', 'Pulgadas'));
    expect(profiles.updatePreferences).toHaveBeenCalledWith(ANA.uid, { units: 'in' });
    expect(radio('Unidades de medida', 'Pulgadas')).toBeChecked();
  });

  it('el tema es Oscuro por defecto', async () => {
    renderProfile();
    expect(await screen.findByRole('radio', { name: 'Oscuro' })).toBeChecked();
    expect(theme()).toBe('dark');
  });

  it('el tema se aplica al instante y se guarda en localStorage y en Firestore', async () => {
    const { profiles } = renderProfile();
    await userEvent.click(await screen.findByRole('radio', { name: 'Claro' }));

    expect(theme()).toBe('light');
    expect(radio('Tema', 'Claro')).toBeChecked();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(profiles.updatePreferences).toHaveBeenCalledWith(ANA.uid, { theme: 'light' });
  });

  it('con "Sistema" sigue el tema del dispositivo', async () => {
    setSystemPrefersLight(true);
    renderProfile();
    await userEvent.click(await screen.findByRole('radio', { name: 'Sistema' }));
    expect(theme()).toBe('light');
  });

  it('el tema persiste al volver a abrir la app', async () => {
    const first = renderProfile();
    await userEvent.click(await screen.findByRole('radio', { name: 'Claro' }));
    first.view.unmount();
    document.documentElement.removeAttribute('data-theme');

    renderProfile({ profile: { theme: 'light' } });
    expect(await screen.findByRole('radio', { name: 'Claro', checked: true })).toBeInTheDocument();
    expect(theme()).toBe('light');
  });

  it('aplica el tema guardado en el perfil, también si cambia desde otro dispositivo', async () => {
    const { profiles } = renderProfile({ profile: { theme: 'light' } });
    expect(await screen.findByRole('radio', { name: 'Claro', checked: true })).toBeInTheDocument();
    expect(theme()).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    act(() => profiles.setRemote(ANA.uid, { theme: 'dark' }));
    expect(theme()).toBe('dark');
    expect(radio('Tema', 'Oscuro')).toBeChecked();
  });

  it('si no se puede guardar una preferencia, avisa con un toast', async () => {
    const { profiles } = renderProfile();
    profiles.updatePreferences.mockRejectedValueOnce(new Error('sin conexión'));
    await userEvent.click(await screen.findByRole('radio', { name: 'Pulgadas' }));
    expect(await screen.findByText('No se pudo guardar la preferencia')).toBeInTheDocument();
  });

  it('cerrar sesión vuelve a /login', async () => {
    const { auth, router } = renderProfile();
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(auth.signOut).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: /Continuar con Google/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('sin beforeinstallprompt (ni iOS) no ofrece instalar', async () => {
    renderProfile();
    await screen.findByRole('heading', { level: 1, name: 'Perfil' });
    expect(
      screen.queryByRole('button', { name: 'Instalar en el dispositivo' }),
    ).not.toBeInTheDocument();
  });

  it('con beforeinstallprompt, "Instalar" abre el diálogo del navegador', async () => {
    renderProfile();
    await screen.findByRole('heading', { level: 1, name: 'Perfil' });
    const event = offerInstall();
    expect(event.defaultPrevented).toBe(true);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Instalar en el dispositivo' }),
    );
    await waitFor(() => expect(event.prompt).toHaveBeenCalled());
    // El evento sirve una sola vez.
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Instalar en el dispositivo' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('en iOS, "Instalar" muestra cómo agregarla a la pantalla de inicio', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE_UA);
    renderProfile();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Instalar en el dispositivo' }),
    );

    const sheet = screen.getByRole('dialog', { name: 'Instalar en el iPhone' });
    expect(sheet).toHaveTextContent('Agregar a inicio');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('instalada, no ofrece instalar', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE_UA);
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    try {
      renderProfile();
      await screen.findByRole('heading', { level: 1, name: 'Perfil' });
      expect(
        screen.queryByRole('button', { name: 'Instalar en el dispositivo' }),
      ).not.toBeInTheDocument();
    } finally {
      delete (navigator as Navigator & { standalone?: boolean }).standalone;
    }
  });
});
