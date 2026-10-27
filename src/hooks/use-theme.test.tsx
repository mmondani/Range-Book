import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY } from '@/lib/theme';
import { setSystemPrefersLight } from '@/test/match-media';
import { useTheme } from './use-theme';

function ThemeProbe() {
  const { preference, resolved, setPreference } = useTheme();
  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <span data-testid="resolved">{resolved}</span>
      <button onClick={() => setPreference('light')}>Claro</button>
      <button onClick={() => setPreference('system')}>Sistema</button>
    </div>
  );
}

const theme = () => document.documentElement.getAttribute('data-theme');

describe('useTheme', () => {
  it('usa el tema oscuro por defecto', () => {
    render(<ThemeProbe />);
    expect(screen.getByTestId('preference')).toHaveTextContent('dark');
    expect(theme()).toBe('dark');
  });

  it('aplica el tema elegido al instante y lo guarda en localStorage', async () => {
    render(<ThemeProbe />);
    await userEvent.click(screen.getByRole('button', { name: 'Claro' }));
    expect(theme()).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
  });

  it('lee la preferencia guardada al montar', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<ThemeProbe />);
    expect(theme()).toBe('light');
  });

  it('con "Sistema" sigue los cambios de prefers-color-scheme', async () => {
    render(<ThemeProbe />);
    await userEvent.click(screen.getByRole('button', { name: 'Sistema' }));
    expect(theme()).toBe('dark');
    act(() => setSystemPrefersLight(true));
    expect(theme()).toBe('light');
    act(() => setSystemPrefersLight(false));
    expect(theme()).toBe('dark');
  });

  it('actualiza el meta theme-color con el fondo del tema', async () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
    render(<ThemeProbe />);
    await userEvent.click(screen.getByRole('button', { name: 'Claro' }));
    expect(meta.getAttribute('content')).toBe('#F6F7F8');
    meta.remove();
  });
});
