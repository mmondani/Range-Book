import { modificationName, toggleModification, type Modification } from '@/lib/firearms';
import { useFieldContext } from './field-context';
import styles from './modification-checklist.module.css';

export interface ModificationChecklistProps {
  options: readonly Modification[];
  selected: readonly string[];
  onChange: (ids: string[]) => void;
}

/**
 * Checkboxes de las modificaciones de un arma. Usar dentro de un `Field` con `kind="group"`: si
 * hay error, el primero queda marcado como inválido para recibir el foco.
 */
export function ModificationChecklist({ options, selected, onChange }: ModificationChecklistProps) {
  const field = useFieldContext();
  const invalid = field?.control['aria-invalid'];
  if (options.length === 0) return null;
  return (
    <ul
      role="group"
      aria-labelledby={field?.labelId}
      aria-describedby={field?.control['aria-describedby']}
      className={styles.checklist}
    >
      {options.map((modification, index) => (
        <li key={modification.id}>
          <label className={styles.option}>
            <input
              type="checkbox"
              checked={selected.includes(modification.id)}
              aria-invalid={index === 0 ? invalid : undefined}
              onChange={(event) =>
                onChange(toggleModification(selected, modification.id, event.target.checked))
              }
            />
            <span className={styles.optionText}>
              <span className={styles.optionName}>
                {modificationName(modification)}
                {modification.archived && ' (archivada)'}
              </span>
              {modification.comments && (
                <span className={styles.optionDetail}>{modification.comments}</span>
              )}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
