import { useRef, type KeyboardEvent } from 'react';
import { cx } from '@/lib/cx';
import styles from './tabs.module.css';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export interface TabsProps<T extends string> {
  /** Prefijo de los ids de las pestañas y sus paneles (ver `tabPanelProps`). */
  id: string;
  tabs: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  'aria-label': string;
  className?: string;
}

export function tabId(id: string, value: string) {
  return `${id}-tab-${value}`;
}

/** Props para el panel de una pestaña. */
export function tabPanelProps(id: string, value: string) {
  return {
    id: `${id}-panel-${value}`,
    role: 'tabpanel' as const,
    'aria-labelledby': tabId(id, value),
  };
}

export function Tabs<T extends string>({
  id,
  tabs,
  value,
  onChange,
  'aria-label': ariaLabel,
  className,
}: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const current = tabs.findIndex((tab) => tab.value === value);
    let next: number;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    const tab = tabs[next];
    if (!tab) return;
    onChange(tab.value);
    refs.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label={ariaLabel} className={cx(styles.list, className)}>
      {tabs.map((tab, index) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            id={tabId(id, tab.value)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={tabPanelProps(id, tab.value).id}
            tabIndex={selected ? 0 : -1}
            className={cx(styles.tab, selected && styles.on)}
            onClick={() => onChange(tab.value)}
            onKeyDown={handleKeyDown}
          >
            {tab.label}
            {/* El espacio separa el contador en el nombre accesible ("Munición 2"). */}
            {tab.count !== undefined && ' '}
            {tab.count !== undefined && (
              <span className={cx(styles.count, 'num')}>{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
