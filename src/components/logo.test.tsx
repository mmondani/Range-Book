import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './logo';

describe('Logo', () => {
  it('con el nombre, muestra "Range Book"', () => {
    render(<Logo withName />);
    expect(screen.getByText('Range Book')).not.toHaveClass('visually-hidden');
  });

  it('sin el nombre, lo deja para lectores de pantalla', () => {
    render(<Logo />);
    expect(screen.getByText('Range Book')).toHaveClass('visually-hidden');
  });
});
