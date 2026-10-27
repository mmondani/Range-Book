import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';

function renderDialog(props: { onConfirm?: () => void; onCancel?: () => void; loading?: boolean }) {
  return render(
    <ConfirmDialog
      open
      title="¿Eliminar la sesión?"
      description="Se eliminan también sus rondas."
      confirmLabel="Eliminar"
      onConfirm={props.onConfirm ?? vi.fn()}
      onCancel={props.onCancel ?? vi.fn()}
      loading={props.loading}
    />,
  );
}

describe('ConfirmDialog', () => {
  it('es un alertdialog con título y descripción, y el foco arranca en Cancelar', () => {
    renderDialog({});
    const dialog = screen.getByRole('alertdialog', { name: '¿Eliminar la sesión?' });
    expect(dialog).toHaveAccessibleDescription('Se eliminan también sus rondas.');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('confirma y cancela', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderDialog({ onConfirm, onCancel });
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('en loading no deja confirmar dos veces', () => {
    renderDialog({ loading: true });
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeDisabled();
  });

  it('cerrado no renderiza nada', () => {
    render(
      <ConfirmDialog
        open={false}
        title="¿Eliminar?"
        confirmLabel="Eliminar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
