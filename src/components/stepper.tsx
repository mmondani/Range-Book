import { Minus, Plus } from 'lucide-react';
import { cx } from '@/lib/cx';
import { useFieldContext } from './field-context';
import styles from './stepper.module.css';

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  decrementLabel: string;
  incrementLabel: string;
  className?: string;
}

/** − valor +. Usar dentro de un `Field` con `kind="group"`. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  decrementLabel,
  incrementLabel,
  className,
}: StepperProps) {
  const field = useFieldContext();
  return (
    <div
      role="group"
      aria-labelledby={field?.labelId}
      aria-describedby={field?.control['aria-describedby']}
      className={cx(styles.stepper, className)}
    >
      <button
        type="button"
        className={styles.step}
        aria-label={decrementLabel}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus aria-hidden="true" />
      </button>
      <output className={cx('display num', styles.value)} aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className={styles.step}
        aria-label={incrementLabel}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus aria-hidden="true" />
      </button>
    </div>
  );
}
