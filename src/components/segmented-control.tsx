import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { useFieldContext } from './field-context';
import styles from './segmented-control.module.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Necesario si no está dentro de un `Field` con `kind="group"`. */
  'aria-label'?: string;
  className?: string;
}

/** Grupo de 2–3 opciones excluyentes (`radiogroup`), navegable con las flechas. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const field = useFieldContext();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const current = options.findIndex((option) => option.value === value);
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = (current + delta + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : field?.labelId}
      className={cx(styles.wrap, className)}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={cx(styles.segment, checked && styles.on)}
            onClick={() => onChange(option.value)}
            onKeyDown={handleKeyDown}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
