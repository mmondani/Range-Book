import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BottomSheet } from './bottom-sheet';
import { Field } from './field';
import { Input } from './input';

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  return (
    <>
      <button onClick={() => setOpen(true)}>Agregar ronda</button>
      <BottomSheet
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        title="Nueva ronda"
        dirty={text !== ''}
      >
        <Field label="Comentarios">
          <Input value={text} onChange={(event) => setText(event.target.value)} />
        </Field>
      </BottomSheet>
    </>
  );
}

async function openSheet() {
  await userEvent.click(screen.getByRole('button', { name: 'Agregar ronda' }));
  return screen.getByRole('dialog', { name: 'Nueva ronda' });
}

describe('BottomSheet', () => {
  it('es un diálogo modal con título y mueve el foco adentro', async () => {
    render(<Harness onClose={vi.fn()} />);
    const dialog = await openSheet();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveFocus();
  });

  it('sin cambios, Escape lo cierra y devuelve el foco al disparador', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await openSheet();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar ronda' })).toHaveFocus();
  });

  it('sin cambios, el botón Cerrar lo cierra', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await openSheet();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('con cambios, Escape pide confirmación en lugar de cerrar', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await openSheet();
    await userEvent.type(screen.getByRole('textbox', { name: 'Comentarios' }), 'tirones');
    await userEvent.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
    const confirm = screen.getByRole('alertdialog', { name: '¿Descartar los cambios?' });
    expect(confirm).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seguir editando' })).toHaveFocus();
  });

  it('Escape en la confirmación solo cierra la confirmación', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await openSheet();
    const input = screen.getByRole('textbox', { name: 'Comentarios' });
    await userEvent.type(input, 'tirones');
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Nueva ronda' })).toBeInTheDocument();
    expect(input).toHaveValue('tirones');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('confirmar el descarte cierra el sheet', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await openSheet();
    await userEvent.type(screen.getByRole('textbox', { name: 'Comentarios' }), 'tirones');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('atrapa el foco con Tab', async () => {
    render(<Harness onClose={vi.fn()} />);
    await openSheet();
    const close = screen.getByRole('button', { name: 'Cerrar' });
    const input = screen.getByRole('textbox', { name: 'Comentarios' });
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab();
    expect(input).toHaveFocus();
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(input).toHaveFocus();
  });
});
