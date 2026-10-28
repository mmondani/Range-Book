import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AppLayout } from './app-layout';

function renderLayout(path = '/sesiones') {
  const router = createMemoryRouter(
    [
      {
        element: <AppLayout user={{ displayName: 'Ana Gómez', email: 'ana@example.com' }} />,
        children: [
          { path: 'sesiones', element: <h1>Sesiones</h1> },
          { path: 'rendimiento', element: <h1>Rendimiento</h1> },
          { path: 'inventario', element: <h1>Inventario</h1> },
          { path: 'perfil', element: <h1>Perfil</h1> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

describe('AppLayout', () => {
  it('tiene barra inferior y sidebar con las 4 secciones, marcando la actual', () => {
    renderLayout('/rendimiento');
    const navs = screen.getAllByRole('navigation', { name: 'Principal' });
    expect(navs).toHaveLength(2);
    for (const nav of navs) {
      const links = within(nav).getAllByRole('link');
      expect(links.map((link) => link.textContent)).toEqual([
        'Sesiones',
        'Rendimiento',
        'Inventario',
        'Perfil',
      ]);
      expect(within(nav).getByRole('link', { name: 'Rendimiento' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
  });

  it('el sidebar tiene la acción "Nueva sesión" y el usuario', () => {
    renderLayout();
    expect(screen.getByRole('link', { name: 'Nueva sesión' })).toHaveAttribute(
      'href',
      '/sesiones/nueva',
    );
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    expect(screen.getByText('AG')).toBeInTheDocument();
  });

  it('al cambiar de ruta mueve el foco al h1', async () => {
    renderLayout();
    const [bottomNav] = screen.getAllByRole('navigation', { name: 'Principal' });
    await userEvent.click(within(bottomNav!).getByRole('link', { name: 'Perfil' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Perfil' })).toHaveFocus();
  });

  it('sin conexión muestra el banner, y lo saca al volver', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderLayout();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Sin conexión — los cambios se guardan y se sincronizan al volver',
    );

    onLine.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText('Sin conexión')).not.toBeInTheDocument();
    onLine.mockRestore();
  });
});
