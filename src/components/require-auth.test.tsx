import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routes } from '@/routes';
import { ANA, createFakeAuth, INTRUDER, never, type FakeAuthOptions } from '@/test/fake-auth';
import { AuthProvider } from './auth-provider';

function renderAt(path: string, options?: FakeAuthOptions) {
  const fake = createFakeAuth(options);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AuthProvider auth={fake.auth} profiles={fake.profiles}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return { ...fake, router };
}

describe('RequireAuth', () => {
  it('sin sesión manda a /login', async () => {
    const { router } = renderAt('/rendimiento');
    expect(await screen.findByRole('button', { name: /Continuar con Google/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('después del login vuelve a la ruta que se había pedido', async () => {
    const { router } = renderAt('/rendimiento?periodo=30d');
    await userEvent.click(await screen.findByRole('button', { name: /Continuar con Google/ }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Rendimiento' }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toBe('?periodo=30d');
  });

  it('mientras verifica la sesión guardada muestra la pantalla de carga', () => {
    const fake = createFakeAuth({ initialUser: ANA });
    fake.auth.isEmailAllowed.mockReturnValueOnce(never());
    render(
      <AuthProvider auth={fake.auth} profiles={fake.profiles}>
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/sesiones'] })} />
      </AuthProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it('con una sesión guardada y autorizada entra directo, con el usuario en el sidebar', async () => {
    renderAt('/rendimiento', { initialUser: ANA });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Rendimiento' }),
    ).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
  });

  it('una sesión guardada de un email que ya no está autorizado termina en /login con la alerta', async () => {
    const { router, auth } = renderAt('/sesiones', { initialUser: INTRUDER });
    expect(await screen.findByRole('alert')).toHaveTextContent('intruso@example.com');
    expect(router.state.location.pathname).toBe('/login');
    expect(auth.signOut).toHaveBeenCalled();
  });
});
