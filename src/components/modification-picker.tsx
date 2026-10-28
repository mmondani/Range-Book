import { Plus } from 'lucide-react';
import { useState } from 'react';
import { modificationName, type Modification } from '@/lib/firearms';
import type { DraftModification } from '@/lib/sessions';
import { Chip } from './chip';
import { ChipGroup } from './chip-group';
import { useFieldContext } from './field-context';
import styles from './modification-picker.module.css';
import { RemovableChip } from './removable-chip';

export interface ModificationPickerProps {
  value: DraftModification[];
  /** Modificaciones del arma que se pueden agregar. */
  available: Modification[];
  onChange: (value: DraftModification[]) => void;
}

/**
 * Personalizaciones de la sesión: chips para quitar y "Agregar", que despliega las modificaciones
 * del arma que faltan. Usar dentro de un `Field` con `kind="group"`.
 */
export function ModificationPicker({ value, available, onChange }: ModificationPickerProps) {
  const field = useFieldContext();
  const [adding, setAdding] = useState(false);
  const showOptions = adding && available.length > 0;

  function add(modification: Modification) {
    const { id, brand, model } = modification;
    onChange([...value, { id, brand, model }]);
    if (available.length === 1) setAdding(false);
  }

  return (
    <div className={styles.picker}>
      <ChipGroup role="group" aria-labelledby={field?.labelId}>
        {value.map((modification, index) => {
          const name = modificationName(modification);
          return (
            <RemovableChip
              key={`${modification.id ?? name}-${index}`}
              removeLabel={`Quitar ${name}`}
              onRemove={() => onChange(value.filter((_, current) => current !== index))}
            >
              {name}
            </RemovableChip>
          );
        })}
        {available.length > 0 && (
          <Chip variant="add" aria-expanded={showOptions} onClick={() => setAdding(!adding)}>
            Agregar
          </Chip>
        )}
      </ChipGroup>
      {showOptions && (
        <ChipGroup role="group" aria-label="Modificaciones para agregar" className={styles.options}>
          {available.map((modification) => (
            <Chip
              key={modification.id}
              variant="selectable"
              icon={<Plus size={18} aria-hidden="true" />}
              aria-pressed={undefined}
              aria-label={`Agregar ${modificationName(modification)}`}
              onClick={() => add(modification)}
            >
              {modificationName(modification)}
            </Chip>
          ))}
        </ChipGroup>
      )}
    </div>
  );
}
