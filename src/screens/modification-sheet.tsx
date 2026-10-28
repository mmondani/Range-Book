import { Field } from '@/components/field';
import { Input } from '@/components/input';
import { InventorySheet } from '@/components/inventory-sheet';
import { Textarea } from '@/components/textarea';
import { useInventoryRepositories } from '@/hooks/use-inventory';
import { useInventorySheet } from '@/hooks/use-inventory-sheet';
import {
  cleanModification,
  firearmName,
  validateModification,
  type Firearm,
  type Modification,
  type ModificationInput,
} from '@/lib/firearms';
import { NAME_MAX_LENGTH, TEXT_MAX_LENGTH } from '@/lib/inventory';
import styles from './inventory-sheet-fields.module.css';

const EMPTY: ModificationInput = { brand: '', model: '', comments: '' };

const MESSAGES = {
  created: 'Modificación agregada',
  archived: 'Modificación archivada',
  restored: 'Modificación restaurada',
};

export interface ModificationSheetProps {
  firearm: Firearm;
  item?: Modification;
}

/** Alta y edición de una modificación del arma (sheet sobre M09 / diálogo sobre W07). */
export function ModificationSheet({ firearm, item }: ModificationSheetProps) {
  const sheet = useInventorySheet({
    item,
    initial: item ? { brand: item.brand, model: item.model, comments: item.comments } : EMPTY,
    validate: validateModification,
    clean: cleanModification,
    repository: useInventoryRepositories().modifications(firearm.id),
    messages: MESSAGES,
  });
  const { draft, errors, setField } = sheet.form;

  return (
    <InventorySheet
      title={item ? 'Editar modificación' : 'Nueva modificación'}
      eyebrow={firearmName(firearm)}
      submitLabel={item ? 'Guardar cambios' : 'Guardar modificación'}
      archive={sheet.archive && { label: 'Archivar modificación', ...sheet.archive }}
      {...sheet.props}
    >
      <div className={styles.pair}>
        <Field label="Marca" required error={errors.brand}>
          <Input
            value={draft.brand}
            onChange={(event) => setField('brand', event.target.value)}
            maxLength={NAME_MAX_LENGTH}
            autoComplete="off"
            placeholder="Ej: Holosun"
            data-autofocus
          />
        </Field>
        <Field label="Modelo" required error={errors.model}>
          <Input
            value={draft.model}
            onChange={(event) => setField('model', event.target.value)}
            maxLength={NAME_MAX_LENGTH}
            autoComplete="off"
            placeholder="Ej: 507C X2"
          />
        </Field>
      </div>
      <Field label="Comentarios">
        <Textarea
          rows={2}
          value={draft.comments}
          onChange={(event) => setField('comments', event.target.value)}
          maxLength={TEXT_MAX_LENGTH}
          placeholder="Ej: Red dot, 2/32 MOA"
        />
      </Field>
    </InventorySheet>
  );
}
