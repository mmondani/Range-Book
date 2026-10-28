import { Pencil, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import type { CollectionState } from '@/hooks/use-collection';
import { useIsDesktop } from '@/hooks/use-media-query';
import { cx } from '@/lib/cx';
import { inventoryList, matchesSearch, type Archivable } from '@/lib/inventory';
import { Alert } from './alert';
import { Badge } from './badge';
import { Button } from './button';
import { Card } from './card';
import { DataTable, type DataTableColumn } from './data-table';
import { EmptyState } from './empty-state';
import { IconButton } from './icon-button';
import styles from './inventory-items.module.css';
import { Skeleton } from './skeleton';

export interface InventoryItemsProps<T extends Archivable> {
  state: CollectionState<T>;
  /** Nombre para ordenar, para las etiquetas de las acciones y para la búsqueda. */
  name: (item: T) => string;
  searchFields: (item: T) => string[];
  showArchived: boolean;
  query?: string;
  /** Mobile: fila con ícono opcional, título y detalle. */
  icon?: ReactNode;
  title: (item: T) => string;
  detail: (item: T) => string;
  /** Desktop: columnas de la tabla (sin la de acciones). */
  columns: ReadonlyArray<DataTableColumn<T>>;
  'aria-label': string;
  /** Estado vacío cuando todavía no se cargó ninguno. */
  empty: { icon: ReactNode; title: string; text: string; action: ReactNode };
  onEdit: (item: T) => void;
  onRestore: (item: T) => void;
}

/** Lista (mobile) o tabla (desktop) de una categoría del inventario, con sus estados. */
export function InventoryItems<T extends Archivable>({
  state,
  name,
  searchFields,
  showArchived,
  query = '',
  icon,
  title,
  detail,
  columns,
  'aria-label': ariaLabel,
  empty,
  onEdit,
  onRestore,
}: InventoryItemsProps<T>) {
  const isDesktop = useIsDesktop();

  if (state.status === 'loading') {
    return (
      <div className={styles.loading} aria-busy="true" aria-label={ariaLabel}>
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} shape="card" height={64} />
        ))}
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <Alert title="No se pudo cargar el inventario">Revisá la conexión y volvé a intentar.</Alert>
    );
  }

  if (state.items.length === 0) {
    return <EmptyState headingLevel={2} {...empty} />;
  }

  const items = inventoryList(state.items, name, showArchived).filter((item) =>
    matchesSearch(searchFields(item), query),
  );

  if (items.length === 0) {
    return query.trim() ? (
      <EmptyState
        icon={empty.icon}
        title="Sin resultados"
        text={`Nada coincide con «${query.trim()}».`}
      />
    ) : (
      <EmptyState
        icon={empty.icon}
        title="Todo archivado"
        text="Marcá «Mostrar archivados» para verlos y restaurarlos."
      />
    );
  }

  function action(item: T) {
    const itemName = name(item);
    if (item.archived) {
      return (
        <Button
          variant="ghost"
          aria-label={`Restaurar ${itemName}`}
          onClick={() => onRestore(item)}
        >
          <RotateCcw aria-hidden="true" size={18} />
          Restaurar
        </Button>
      );
    }
    return (
      <IconButton aria-label={`Editar ${itemName}`} onClick={() => onEdit(item)}>
        <Pencil aria-hidden="true" size={20} />
      </IconButton>
    );
  }

  if (isDesktop) {
    return (
      <DataTable
        aria-label={ariaLabel}
        rows={items}
        rowKey={(item) => item.id}
        dimmed={(item) => item.archived}
        columns={[
          ...columns,
          {
            key: 'actions',
            header: 'Acciones',
            hideHeader: true,
            kind: 'actions',
            cell: (item) => (
              <span className={styles.actions}>
                {item.archived && <Badge>Archivado</Badge>}
                {action(item)}
              </span>
            ),
          },
        ]}
      />
    );
  }

  return (
    <Card as="section" padded={false} aria-label={ariaLabel}>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={cx(styles.row, item.archived && styles.archived)}>
            {icon && (
              <span className={styles.icon} aria-hidden="true">
                {icon}
              </span>
            )}
            <div className={styles.text}>
              <span className={styles.title}>{title(item)}</span>
              {detail(item) && <span className={styles.detail}>{detail(item)}</span>}
              {item.archived && <Badge className={styles.badge}>Archivado</Badge>}
            </div>
            {action(item)}
          </li>
        ))}
      </ul>
    </Card>
  );
}
