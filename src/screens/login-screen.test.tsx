import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '@/components/auth-provider';
import { routes } from '@/routes';
import { ANA, createFakeAuth, INTRUDER, never, type FakeAuthOptions } from '@/test/fake-auth';

function renderLogin(options?: FakeAuthOptions) {
  const fake = createFakeAuth(options);
  const router = createMemoryRouter(routes, { initialEntries: ['/login'] });
  render(
    <AuthProvider auth={fake.auth} profiles={fake.profiles}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return { ...fake, router };
}

const googleButton = () => screen.getByRole('button', { name: /Continuar con Google/ });

describe('LoginScreen', () => {
  it('estado inicial: una sola acción, "Continuar con Google", sin alertas', () => {
    renderLogin();
    expect(googleButton()).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('cargando: el botón muestra el spinner mientras está abierto el selector de cuentas', async () => {
    const { auth } = renderLogin();
    auth.signIn.mockReturnValueOnce(never());
    await userEvent.click(googleButton());
    expect(googleButton()).toBeDisabled();
    expect(googleButton()).toHaveAttribute('aria-busy', 'true');
  });

  it('cargando: sigue así mientras se verifica que el email esté autorizado', async () => {
    const { auth } = renderLogin();
    auth.isEmailAllowed.mockReturnValueOnce(never());
    await userEvent.click(googleButton());
    expect(auth.isEmailAllowed).toHaveBeenCalledWith(ANA.email);
    expect(googleButton()).toHaveAttribute('aria-busy', 'true');
  });

  it('un email autorizado entra a Sesiones y se crea su perfil', async () => {
    const { auth, profiles, router } = renderLogin();
    await userEvent.click(googleButton());
    expect(auth.signIn).toHaveBeenCalledWith('popup');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sesiones' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sesiones');
    expect(profiles.ensureProfile).toHaveBeenCalledWith(ANA);
  });

  it('no autorizado: cierra la sesión de Firebase y muestra la alerta con el email usado', async () => {
    const { auth, profiles } = renderLogin({ signInAs: INTRUDER });
    await userEvent.click(googleButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Esta cuenta no está autorizada');
    expect(alert).toHaveTextContent('intruso@example.com no figura en la lista de acceso');
    expect(alert).toHaveTextContent('Probá con otra cuenta');
    expect(auth.signOut).toHaveBeenCalled();
    expect(profiles.ensureProfile).not.toHaveBeenCalled();
    expect(googleButton()).toBeEnabled();
  });

  it('no autorizado también si las reglas niegan la lectura de la lista', async () => {
    const { auth } = renderLogin();
    auth.isEmailAllowed.mockRejectedValueOnce({ code: 'permission-denied' });
    await userEvent.click(googleButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta cuenta no está autorizada');
    expect(auth.signOut).toHaveBeenCalled();
  });

  it('error de red al ingresar: alerta con "Reintentar", que vuelve a intentar el login', async () => {
    const { auth } = renderLogin();
    auth.signIn.mockRejectedValueOnce({ code: 'auth/network-request-failed' });
    await userEvent.click(googleButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Sin conexión');
    await userEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(auth.signIn).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('heading', { level: 1, name: 'Sesiones' })).toBeInTheDocument();
  });

  it('error de red al verificar: "Reintentar" repite la verificación sin pedir la cuenta de nuevo', async () => {
    const { auth } = renderLogin();
    auth.isEmailAllowed.mockRejectedValueOnce({ code: 'unavailable' });
    await userEvent.click(googleButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Sin conexión');
    await userEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sesiones' })).toBeInTheDocument();
    expect(auth.signIn).toHaveBeenCalledTimes(1);
    expect(auth.isEmailAllowed).toHaveBeenCalledTimes(2);
  });

  it('si el usuario cierra el selector de cuentas no muestra ningún error', async () => {
    const { auth } = renderLogin();
    auth.signIn.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
    await userEvent.click(googleButton());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(googleButton()).toBeEnabled();
  });

  it('si el navegador bloquea el popup, usa redirect', async () => {
    const { auth } = renderLogin();
    auth.signIn.mockRejectedValueOnce({ code: 'auth/popup-blocked' });
    await userEvent.click(googleButton());
    expect(auth.signIn).toHaveBeenLastCalledWith('redirect');
  });

  it('un error inesperado al volver de un redirect se muestra con "Reintentar"', async () => {
    const fake = createFakeAuth();
    fake.auth.completeRedirect.mockRejectedValueOnce({ code: 'auth/internal-error' });
    const router = createMemoryRouter(routes, { initialEntries: ['/login'] });
    render(
      <AuthProvider auth={fake.auth} profiles={fake.profiles}>
        <RouterProvider router={router} />
      </AuthProvider>,
    );
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se pudo ingresar');
    expect(within(alert).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
