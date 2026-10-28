import { Field } from '@/components/field';
import { Input } from '@/components/input';
import { InventorySheet } from '@/components/inventory-sheet';
import { useInventoryRepositories } from '@/hooks/use-inventory';
import { useInventorySheet } from '@/hooks/use-inventory-sheet';
import {
  cleanRange,
  NAME_MAX_LENGTH,
  TEXT_MAX_LENGTH,
  validateRange,
  type Range,
  type RangeInput,
} from '@/lib/inventory';

const EMPTY: RangeInput = { name: '', address: '' };

const MESSAGES = {
  created: 'Polígono agregado',
  archived: 'Polígono archivado',
  restored: 'Polígono restaurado',
};

/** Alta y edición de un polígono (sheet sobre M08 / diálogo sobre W06). */
export function RangeSheet({ item }: { item?: Range }) {
  const sheet = useInventorySheet({
    item,
    initial: item ? { name: item.name, address: item.address } : EMPTY,
    validate: validateRange,
    clean: cleanRange,
    repository: useInventoryRepositories().ranges,
    messages: MESSAGES,
  });
  const { draft, errors, setField } = sheet.form;

  return (
    <InventorySheet
      title={item ? 'Editar polígono' : 'Nuevo polígono'}
      eyebrow={item ? item.name : 'Inventario'}
      submitLabel={item ? 'Guardar cambios' : 'Guardar polígono'}
      archive={sheet.archive && { label: 'Archivar polígono', ...sheet.archive }}
      {...sheet.props}
    >
      <Field label="Nombre" required error={errors.name}>
        <Input
          value={draft.name}
          onChange={(event) => setField('name', event.target.value)}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="off"
          placeholder="Ej: Club de Tiro Los Álamos"
          data-autofocus
        />
      </Field>
      <Field label="Dirección">
        <Input
          value={draft.address}
          onChange={(event) => setField('address', event.target.value)}
          maxLength={TEXT_MAX_LENGTH}
          autoComplete="street-address"
        />
      </Field>
    </InventorySheet>
  );
}
