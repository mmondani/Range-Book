import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SegmentedControl } from './segmented-control';

const OPTIONS = [
  { value: 'dark', label: 'Oscuro' },
  { value: 'light', label: 'Claro' },
  { value: 'system', label: 'Sistema' },
] as const;

function Harness() {
  const [value, setValue] = useState<'dark' | 'light' | 'system'>('dark');
  return <SegmentedControl aria-label="Tema" options={OPTIONS} value={value} onChange={setValue} />;
}

describe('SegmentedControl', () => {
  it('es un radiogroup con la opción elegida marcada', async () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Tema' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Claro' }));
    expect(screen.getByRole('radio', { name: 'Claro' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toHaveAttribute('aria-checked', 'false');
  });

  it('solo la opción elegida está en el orden de tabulación y las flechas la cambian', async () => {
    render(<Harness />);
    await userEvent.tab();
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Claro' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Claro' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Sistema' })).toHaveAttribute('aria-checked', 'true');
  });
});
