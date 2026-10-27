import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '@/app';

describe('App', () => {
  it('redirige a Sesiones dentro del layout principal', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Sesiones' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('aplica el tema oscuro por defecto', () => {
    render(<App />);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });
});
