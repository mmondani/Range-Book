import { Field } from '@/components/field';
import { Input } from '@/components/input';
import { InventorySheet } from '@/components/inventory-sheet';
import { Textarea } from '@/components/textarea';
import { useInventoryRepositories } from '@/hooks/use-inventory';
import { useInventorySheet } from '@/hooks/use-inventory-sheet';
import {
  ammunitionName,
  cleanAmmunition,
  NAME_MAX_LENGTH,
  TEXT_MAX_LENGTH,
  validateAmmunition,
  type Ammunition,
  type AmmunitionInput,
} from '@/lib/inventory';
import styles from './inventory-sheet-fields.module.css';

const EMPTY: AmmunitionInput = { brand: '', model: '', description: '' };

const MESSAGES = {
  created: 'Munición agregada',
  archived: 'Munición archivada',
  restored: 'Munición restaurada',
};

/** Alta y edición de munición (sheet sobre M08 / diálogo sobre W06). */
export function AmmunitionSheet({ item }: { item?: Ammunition }) {
  const sheet = useInventorySheet({
    item,
    initial: item ? { brand: item.brand, model: item.model, description: item.description } : EMPTY,
    validate: validateAmmunition,
    clean: cleanAmmunition,
    repository: useInventoryRepositories().ammunition,
    messages: MESSAGES,
  });
  const { draft, errors, setField } = sheet.form;

  return (
    <InventorySheet
      title={item ? 'Editar munición' : 'Nueva munición'}
      eyebrow={item ? ammunitionName(item) : 'Inventario'}
      submitLabel={item ? 'Guardar cambios' : 'Guardar munición'}
      archive={sheet.archive && { label: 'Archivar munición', ...sheet.archive }}
      {...sheet.props}
    >
      <div className={styles.pair}>
        <Field label="Marca" required error={errors.brand}>
          <Input
            value={draft.brand}
            onChange={(event) => setField('brand', event.target.value)}
            maxLength={NAME_MAX_LENGTH}
            autoComplete="off"
            placeholder="Ej: Magtech"
            data-autofocus
          />
        </Field>
        <Field label="Modelo" required error={errors.model}>
          <Input
            value={draft.model}
            onChange={(event) => setField('model', event.target.value)}
            maxLength={NAME_MAX_LENGTH}
            autoComplete="off"
            placeholder="Ej: 9mm FMJ"
          />
        </Field>
      </div>
      <Field label="Descripción">
        <Textarea
          rows={2}
          value={draft.description}
          onChange={(event) => setField('description', event.target.value)}
          maxLength={TEXT_MAX_LENGTH}
          placeholder="Ej: 115 gr, encamisada, práctica"
        />
      </Field>
    </InventorySheet>
  );
}
