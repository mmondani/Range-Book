import { ChevronDown, ChevronUp } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './data-table.module.css';

export interface DataTableColumn<T> {
  key: string;
  /** Si `hideHeader`, el encabezado queda solo para lectores de pantalla (por ejemplo, "Acciones"). */
  header: string;
  hideHeader?: boolean;
  cell: (row: T) => ReactNode;
  /**
   * `primary` resalta la columna principal; `muted`, una secundaria; `numeric` alinea números a la
   * derecha; `actions` alinea a la derecha.
   */
  kind?: 'primary' | 'muted' | 'numeric' | 'actions';
  /** Si la tabla se ordena por esta columna (ver `sort`). */
  sortable?: boolean;
}

export interface DataTableSort {
  key: string;
  direction: 'ascending' | 'descending';
}

export interface DataTableProps<T> {
  columns: ReadonlyArray<DataTableColumn<T>>;
  rows: readonly T[];
  rowKey: (row: T) => string;
  'aria-label': string;
  /** Filas atenuadas (por ejemplo, archivadas). */
  dimmed?: (row: T) => boolean;
  /**
   * Clic en cualquier parte de la fila (salvo sus links y botones). Es un atajo para el mouse: la
   * fila tiene que tener también un link o botón con la misma acción, para el teclado.
   */
  onRowClick?: (row: T) => void;
  /** Orden actual. Las filas llegan ya ordenadas; el encabezado solo lo muestra y lo cambia. */
  sort?: DataTableSort;
  onSortChange?: (key: string) => void;
  className?: string;
}

/** Tabla de desktop, con scroll horizontal en su contenedor y columnas ordenables. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  'aria-label': ariaLabel,
  dimmed,
  onRowClick,
  sort,
  onSortChange,
  className,
}: DataTableProps<T>) {
  function handleRowClick(event: MouseEvent<HTMLTableRowElement>, row: T) {
    if ((event.target as Element).closest('a, button, input, select, textarea, label')) return;
    onRowClick?.(row);
  }

  return (
    <div className={cx(styles.container, className)}>
      <table className={styles.table} aria-label={ariaLabel}>
        <thead>
          <tr>
            {columns.map((column) => {
              const direction = sort?.key === column.key ? sort.direction : undefined;
              const Icon = direction === 'ascending' ? ChevronUp : ChevronDown;
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={column.kind && styles[column.kind]}
                  aria-sort={column.sortable ? (direction ?? 'none') : undefined}
                >
                  {column.hideHeader ? (
                    <span className="visually-hidden">{column.header}</span>
                  ) : column.sortable && onSortChange ? (
                    <button
                      type="button"
                      className={cx(styles.sort, direction && styles.sorted)}
                      onClick={() => onSortChange(column.key)}
                    >
                      {column.header}
                      <Icon className={styles.sortIcon} aria-hidden="true" />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cx(dimmed?.(row) && styles.dimmed, onRowClick && styles.clickable)}
              onClick={onRowClick && ((event) => handleRowClick(event, row))}
            >
              {columns.map((column) => (
                <td key={column.key} className={column.kind && styles[column.kind]}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
