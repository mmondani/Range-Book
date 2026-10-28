import { X } from 'lucide-react';
import { useId } from 'react';
import { cx } from '@/lib/cx';
import { formatInteger } from '@/lib/format';
import type { TargetPoint } from '@/lib/target-zones';
import { formatLengthValue, UNIT_SYMBOLS, type Units } from '@/lib/units';
import { Card } from './card';
import { DataTable, type DataTableColumn } from './data-table';
import { IconButton } from './icon-button';
import styles from './impact-table.module.css';

export interface ImpactTableProps {
  /** En mm desde el centro del blanco. */
  impacts: readonly TargetPoint[];
  /** Zona de cada impacto; sin ella (blanco sin zonas) no hay columna "Zona". */
  zoneOf?: (impact: TargetPoint) => number;
  units: Units;
  onRemove: (index: number) => void;
  className?: string;
}

interface ImpactRow {
  index: number;
  impact: TargetPoint;
}

/**
 * Impactos del análisis (W04): número, zona y posición desde el centro. Es también la forma
 * accesible de quitar un impacto sin precisión de puntero.
 */
export function ImpactTable({ impacts, zoneOf, units, onRemove, className }: ImpactTableProps) {
  const titleId = useId();
  const unit = UNIT_SYMBOLS[units];
  const zoneColumn: DataTableColumn<ImpactRow>[] = zoneOf
    ? [
        {
          key: 'zone',
          header: 'Zona',
          kind: 'primary',
          cell: ({ impact }) => <span className="num">{formatInteger(zoneOf(impact))}</span>,
        },
      ]
    : [];
  const columns: DataTableColumn<ImpactRow>[] = [
    { key: 'number', header: '#', cell: ({ index }) => <span className="num">{index + 1}</span> },
    ...zoneColumn,
    {
      key: 'x',
      header: `X ${unit}`,
      cell: ({ impact }) => <span className="num">{formatLengthValue(impact.x, units)}</span>,
    },
    {
      key: 'y',
      header: `Y ${unit}`,
      cell: ({ impact }) => <span className="num">{formatLengthValue(impact.y, units)}</span>,
    },
    {
      key: 'actions',
      header: 'Quitar',
      hideHeader: true,
      kind: 'actions',
      cell: ({ index }) => (
        <IconButton aria-label={`Quitar impacto ${index + 1}`} onClick={() => onRemove(index)}>
          <X aria-hidden="true" size={18} />
        </IconButton>
      ),
    },
  ];

  return (
    <Card
      as="section"
      padded={false}
      aria-labelledby={titleId}
      className={cx(styles.card, className)}
    >
      <h2 id={titleId} className={styles.title}>
        Impactos <span className="num">({impacts.length})</span>
      </h2>
      {impacts.length > 0 && (
        <div className={styles.scroll}>
          <DataTable
            aria-label="Impactos"
            columns={columns}
            rows={impacts.map((impact, index) => ({ index, impact }))}
            rowKey={({ index }) => String(index)}
          />
        </div>
      )}
    </Card>
  );
}
