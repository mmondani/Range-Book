import type { MouseEvent, ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './data-table.module.css';

export interface DataTableColumn<T> {
  key: string;
  /** Si `hideHeader`, el encabezado queda solo para lectores de pantalla (por ejemplo, "Acciones"). */
  header: string;
  hideHeader?: boolean;
  cell: (row: T) => ReactNode;
  /** `primary` resalta la columna principal; `muted`, una secundaria; `actions` alinea a la derecha. */
  kind?: 'primary' | 'muted' | 'actions';
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
  className?: string;
}

/** Tabla de desktop, con scroll horizontal en su contenedor. El orden llega con Rendimiento. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  'aria-label': ariaLabel,
  dimmed,
  onRowClick,
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
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.kind && styles[column.kind]}>
                {column.hideHeader ? (
                  <span className="visually-hidden">{column.header}</span>
                ) : (
                  column.header
                )}
              </th>
            ))}
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
