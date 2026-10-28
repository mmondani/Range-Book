import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Stepper } from './stepper';

function Harness({ initial, min, max }: { initial: number; min?: number; max?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <Stepper
      value={value}
      onChange={setValue}
      min={min}
      max={max}
      decrementLabel="Restar un disparo"
      incrementLabel="Sumar un disparo"
    />
  );
}

describe('Stepper', () => {
  it('suma y resta de a uno', async () => {
    render(<Harness initial={15} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sumar un disparo' }));
    expect(screen.getByRole('status')).toHaveTextContent('16');
    await userEvent.click(screen.getByRole('button', { name: 'Restar un disparo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Restar un disparo' }));
    expect(screen.getByRole('status')).toHaveTextContent('14');
  });

  it('no baja del mínimo ni sube del máximo', async () => {
    render(<Harness initial={1} min={1} max={2} />);
    expect(screen.getByRole('button', { name: 'Restar un disparo' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Sumar un disparo' }));
    expect(screen.getByRole('status')).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: 'Sumar un disparo' })).toBeDisabled();
  });
});
