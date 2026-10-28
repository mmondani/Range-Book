import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '@/app';
import { ANA, createFakeAuth } from '@/test/fake-auth';
import { createFakeInventory } from '@/test/fake-inventory';
import { createFakePhotos } from '@/test/fake-photos';
import { createFakeSessions } from '@/test/fake-sessions';

function renderApp() {
  const { auth, profiles } = createFakeAuth({ initialUser: ANA });
  return render(
    <App
      auth={auth}
      profiles={profiles}
      photos={createFakePhotos().repository}
      inventory={createFakeInventory().repositories}
      sessions={createFakeSessions().repository}
    />,
  );
}

describe('App', () => {
  it('con sesión, redirige a Sesiones dentro del layout principal', async () => {
    renderApp();
    expect(await screen.findByRole('heading', { level: 1, name: 'Sesiones' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('aplica el tema oscuro por defecto', () => {
    renderApp();
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });
});
