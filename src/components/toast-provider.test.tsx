import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOAST_DURATION_MS, useToast, type ToastOptions } from '@/hooks/use-toast';
import { ToastProvider } from './toast-provider';

function Trigger({ options }: { options: ToastOptions }) {
  const toast = useToast();
  return <button onClick={() => toast.show(options)}>Mostrar</button>;
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('anuncia el mensaje en una región aria-live y se cierra solo a los 4 s', () => {
    render(
      <ToastProvider>
        <Trigger options={{ message: 'Sesión guardada' }} />
      </ToastProvider>,
    );
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    expect(region).toHaveTextContent('Sesión guardada');

    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1));
    expect(region).toHaveTextContent('Sesión guardada');
    act(() => vi.advanceTimersByTime(1));
    expect(region).toBeEmptyDOMElement();
  });

  it('ejecuta la acción "Deshacer" y cierra el toast', () => {
    const onAction = vi.fn();
    render(
      <ToastProvider>
        <Trigger
          options={{ message: 'Sesión eliminada', action: { label: 'Deshacer', onAction } }}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('useToast fuera del provider avisa del error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Trigger options={{ message: 'x' }} />)).toThrow(/ToastProvider/);
  });
});
