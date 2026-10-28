import { Pencil } from 'lucide-react';
import { useNavigate } from 'react-router';
import { OPENED_FROM_LIST } from '@/hooks/use-inventory';
import { formatDecimal, formatInteger } from '@/lib/format';
import { storedPhotos } from '@/lib/photos';
import type { RoundItem } from '@/lib/rounds';
import { formatLength, type Units } from '@/lib/units';
import { DataTable, type DataTableColumn } from './data-table';
import { IconLink } from './icon-link';
import { LinkButton } from './link-button';
import { RoundStatus } from './round-status';
import { TargetThumb } from './target-thumb';
import styles from './round-table.module.css';

export interface RoundTableProps {
  items: readonly RoundItem[];
  units: Units;
  editPath: (item: RoundItem) => string;
  analysisPath: (item: RoundItem) => string;
}

/**
 * Rondas del detalle de la sesión en desktop (W02): `RoundRow` como fila de tabla. Un clic en la
 * fila lleva al análisis, igual que el botón de la columna de acciones.
 */
export function RoundTable({ items, units, editPath, analysisPath }: RoundTableProps) {
  const navigate = useNavigate();
  const columns: DataTableColumn<RoundItem>[] = [
    {
      key: 'photo',
      header: 'Foto',
      hideHeader: true,
      cell: ({ round, target, number }) => (
        <TargetThumb
          scoring={target?.scoring ?? 'rings'}
          zones={target?.zones ?? []}
          photo={storedPhotos(round.photo ? [round.photo] : [])[0]}
          alt={`Foto del blanco de la ronda ${number}`}
          className={styles.thumb}
        />
      ),
    },
    {
      key: 'round',
      header: 'Ronda',
      kind: 'primary',
      cell: ({ number, targetLabel }) => `${number} · ${targetLabel}`,
    },
    {
      key: 'distance',
      header: 'Distancia',
      cell: ({ round }) => <span className="num">{formatDecimal(round.distanceM)} m</span>,
    },
    {
      key: 'shots',
      header: 'Disparos',
      cell: ({ round }) => <span className="num">{formatInteger(round.shots)}</span>,
    },
    {
      key: 'score',
      header: 'Puntaje',
      cell: ({ score }) =>
        score === null ? '—' : <strong className="num">{formatInteger(score)}</strong>,
    },
    {
      key: 'group',
      header: 'Grupo',
      cell: ({ round }) => {
        const group = round.analysis?.metrics.groupSizeMm;
        return group == null ? '—' : <span className="num">{formatLength(group, units)}</span>;
      },
    },
    {
      key: 'comments',
      header: 'Comentarios',
      kind: 'muted',
      cell: ({ round }) => round.comments || '—',
    },
    {
      key: 'status',
      header: 'Análisis',
      cell: ({ analyzed }) => <RoundStatus analyzed={analyzed} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      hideHeader: true,
      kind: 'actions',
      cell: (item) => {
        const label = item.analyzed ? 'Ver análisis' : 'Analizar blanco';
        return (
          <span className={styles.actions}>
            <LinkButton
              variant="ghost"
              to={analysisPath(item)}
              aria-label={`${label} de la ronda ${item.number}`}
              className={styles.analysis}
            >
              {label}
            </LinkButton>
            <IconLink
              to={editPath(item)}
              state={OPENED_FROM_LIST}
              aria-label={`Editar ronda ${item.number}`}
            >
              <Pencil aria-hidden="true" size={20} />
            </IconLink>
          </span>
        );
      },
    },
  ];

  return (
    <DataTable
      aria-label="Rondas"
      columns={columns}
      rows={items}
      rowKey={(item) => item.round.id}
      onRowClick={(item) => navigate(analysisPath(item))}
    />
  );
}
