import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Input } from '@/components/input';
import { TUNING_FIELDS, tuningValues, type TuningKey, type TuningValues } from '../lib/tuning';
import styles from './tool.module.css';

export interface ParameterFormProps {
  values: TuningValues;
  errors: readonly TuningKey[];
  onChange: (values: TuningValues) => void;
}

/** Parámetros de la detección para la evaluación (por defecto, los de la app). */
export function ParameterForm({ values, errors, onChange }: ParameterFormProps) {
  return (
    <section aria-label="Parámetros de la detección" className={styles.stack}>
      <div className={styles.params}>
        {TUNING_FIELDS.map(({ key, label, help }) => (
          <Field
            key={key}
            label={label}
            help={help}
            error={errors.includes(key) ? 'Ingresá un número mayor que 0' : undefined}
          >
            <Input
              value={values[key]}
              onChange={(event) => onChange({ ...values, [key]: event.target.value })}
              inputMode="decimal"
              autoComplete="off"
              className="num"
            />
          </Field>
        ))}
      </div>
      <div className={styles.row}>
        <Button variant="ghost" onClick={() => onChange(tuningValues())}>
          Volver a los de la app
        </Button>
      </div>
    </section>
  );
}
