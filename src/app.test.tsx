import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '@/app';

describe('App', () => {
  it('renderiza el contenedor principal', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
