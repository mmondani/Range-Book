import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './field';
import { Input } from './input';
import { Select } from './select';
import { Stepper } from './stepper';

describe('Field', () => {
  it('asocia la etiqueta con el control', () => {
    render(
      <Field label="Distancia" required>
        <Input suffix="m" />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: /Distancia/ });
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('describe el control con la ayuda y el error, y marca aria-invalid', () => {
    render(
      <Field label="Munición" help="La última usada con esta arma." error="Elegí una munición.">
        <Select>
          <option>Magtech</option>
        </Select>
      </Field>,
    );
    const select = screen.getByRole('combobox', { name: 'Munición' });
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription(
      'La última usada con esta arma. Elegí una munición.',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Elegí una munición.');
  });

  it('en un grupo, el control referencia la etiqueta con aria-labelledby', () => {
    render(
      <Field label="Disparos" kind="group">
        <Stepper
          value={10}
          onChange={() => undefined}
          decrementLabel="Restar un disparo"
          incrementLabel="Sumar un disparo"
        />
      </Field>,
    );
    expect(screen.getByRole('group', { name: 'Disparos' })).toBeInTheDocument();
  });
});
