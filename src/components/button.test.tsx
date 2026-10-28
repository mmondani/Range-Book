import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';
import { IconButton } from './icon-button';

describe('Button', () => {
  it('es type="button" por defecto para no enviar formularios', () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('type', 'button');
  });

  it('en loading se desactiva, marca aria-busy y no dispara onClick', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Guardar
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disabled no dispara onClick', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Guardar
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy');
  });
});

describe('IconButton', () => {
  it('se anuncia con su aria-label', () => {
    render(<IconButton aria-label="Buscar sesiones">🔍</IconButton>);
    expect(screen.getByRole('button', { name: 'Buscar sesiones' })).toBeInTheDocument();
  });
});
