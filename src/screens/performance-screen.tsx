import { Download, SearchX, TrendingUp } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Alert } from '@/components/alert';
import { AmmunitionComparison } from '@/components/ammunition-comparison';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { ChipGroup } from '@/components/chip-group';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { Field } from '@/components/field';
import { FilterSheet } from '@/components/filter-sheet';
import { LineChart } from '@/components/line-chart';
import { LinkButton } from '@/components/link-button';
import { MetricTile } from '@/components/metric-tile';
import { Select } from '@/components/select';
import { Skeleton } from '@/components/skeleton';
import { useIsDesktop } from '@/hooks/use-media-query';
import { useUnits } from '@/hooks/use-profile';
import { useSessionData } from '@/hooks/use-session-data';
import type { ChartPoint } from '@/lib/chart';
import { cx } from '@/lib/cx';
import { formatDayMonth, formatDecimal, formatInteger, formatIsoDate, isoDate } from '@/lib/format';
import { ammunitionName } from '@/lib/inventory';
import {
  ALL_DISTANCES,
  csvFileName,
  DEFAULT_PERIOD,
  DEFAULT_SORT,
  describeDelta,
  distanceParam,
  FILTER_PARAMS,
  filterOptions,
  formatDistances,
  formatMeasure,
  formatMeasureValue,
  formatMpi,
  hasActiveFilters,
  hasAnalyzedRounds,
  measureUnit,
  parseFilters,
  performanceCsv,
  performanceReport,
  PERIOD_LABELS,
  PERIODS,
  sortRows,
  toggleSort,
  type DeltaDescription,
  type FilterKey,
  type FilterOption,
  type SessionPerformance,
  type SortKey,
} from '@/lib/performance';
import { sessionLabels } from '@/lib/sessions';
import { fromMm } from '@/lib/units';
import styles from './performance-screen.module.css';

/** Filtro abierto en el sheet de mobile (con URL propia: "atrás" lo cierra). */
const SHEET_PARAM = 'filtro';

/** Marca la entrada del historial que abre el sheet desde la pantalla. */
const OPENED_FROM_SCREEN = { fromScreen: true };

const CHART_HEIGHT = { mobile: 180, desktop: 240 };

interface FilterDefinition {
  key: FilterKey;
  label: string;
  /** Valor en la query string (vacío = el default). */
  value: string;
  defaultValue: string;
  options: FilterOption[];
  /** Lo que muestra el chip de mobile. */
  display: string;
  /** El filtro restringe los datos (chip resaltado). */
  active: boolean;
}

function DeltaText({ delta }: { delta: DeltaDescription }) {
  if (delta.direction === 'same') return <>Igual que el período anterior</>;
  return (
    <>
      <span aria-hidden="true">{delta.direction === 'up' ? '▲' : '▼'} </span>
      <span className="visually-hidden">{delta.direction === 'up' ? 'Subió ' : 'Bajó '}</span>
      {delta.amount} ({delta.better ? 'mejor' : 'peor'})
    </>
  );
}

/** Ayuda y color de una `StatTile` con delta. */
function deltaProps(delta: DeltaDescription | null): { help?: ReactNode; trend?: 'up' | 'down' } {
  if (!delta) return {};
  return {
    help: <DeltaText delta={delta} />,
    trend: delta.better === null ? undefined : delta.better ? 'up' : 'down',
  };
}

/**
 * M07 / W05 · Rendimiento. Los filtros van en la query string: en mobile son chips que abren un
 * sheet; en desktop, selects. Por defecto se ven los últimos 90 días a la distancia más usada.
 */
export function PerformanceScreen() {
  const data = useSessionData();
  const units = useUnits();
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [today] = useState(() => isoDate());
  const [sort, setSort] = useState(DEFAULT_SORT);

  const search = searchParams.toString();
  const filters = useMemo(() => parseFilters(new URLSearchParams(search)), [search]);
  const ready = data.status === 'ready' ? data : undefined;
  const report = useMemo(
    () => ready && performanceReport(ready.sessions, filters, today),
    [ready, filters, today],
  );
  const options = useMemo(
    () => ready && filterOptions(ready.sessions, ready.lookups, ready.targets),
    [ready],
  );

  function header(children?: ReactNode) {
    return (
      <div className={styles.screen}>
        <h1 className={cx('display', styles.title)}>Rendimiento</h1>
        {children}
      </div>
    );
  }

  if (data.status === 'loading' || !ready || !report || !options) {
    if (data.status === 'error') {
      return header(
        <Alert title="No se pudo cargar el rendimiento">
          Revisá la conexión y volvé a intentar.
        </Alert>,
      );
    }
    return header(
      <div className={styles.loading} aria-busy="true" aria-label="Cargando rendimiento">
        <Skeleton shape="card" height={isDesktop ? 88 : 96} />
        <div className={styles.kpis}>
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} shape="card" height={104} />
          ))}
        </div>
        <Skeleton shape="card" height={isDesktop ? 300 : 220} />
      </div>,
    );
  }

  if (!hasAnalyzedRounds(ready.sessions)) {
    return header(
      <EmptyState
        icon={<TrendingUp />}
        title="Analizá tus blancos para ver la evolución"
        text="Cuando marques los impactos de tus rondas, acá vas a ver el puntaje, el tamaño de grupo y el PMI de cada sesión."
        action={
          <LinkButton to="/sesiones" variant="primary">
            Ir a sesiones
          </LinkButton>
        }
      />,
    );
  }

  const { measure, current, deltas } = report;
  const unit = measureUnit(measure, units);
  const measureValue = (value: number) => formatMeasureValue(value, measure, units);
  const toDisplay = (value: number) => (measure === 'moa' ? value : fromMm(value, units));
  const distanceText = report.distanceM === null ? 'Todas' : `${formatDecimal(report.distanceM)} m`;

  // --- Filtros -------------------------------------------------------------------------------

  const optionLabel = (list: FilterOption[], value: string) =>
    list.find((option) => option.value === value)?.label ?? '—';

  const definitions: FilterDefinition[] = (
    [
      {
        key: 'configuration',
        label: 'Configuración',
        value: filters.configuration,
        defaultValue: '',
        options: [{ value: '', label: 'Todas' }, ...options.configuration],
        display: '',
        active: filters.configuration !== '',
      },
      {
        key: 'ammunitionId',
        label: 'Munición',
        value: filters.ammunitionId,
        defaultValue: '',
        options: [{ value: '', label: 'Todas' }, ...options.ammunitionId],
        display: '',
        active: filters.ammunitionId !== '',
      },
      {
        key: 'distanceM',
        label: 'Distancia',
        value: distanceParam(filters.distanceM),
        defaultValue: '',
        options: [
          {
            value: '',
            label:
              filters.distanceM === undefined && report.distanceM !== null
                ? `La más usada (${distanceText})`
                : 'La más usada',
          },
          ...options.distanceM.map((distance) => ({
            value: String(distance),
            label: `${formatDecimal(distance)} m`,
          })),
          { value: ALL_DISTANCES, label: 'Todas' },
        ],
        display: distanceText,
        active: report.distanceM !== null,
      },
      {
        key: 'targetId',
        label: 'Blanco',
        value: filters.targetId,
        defaultValue: '',
        options: [{ value: '', label: 'Todos' }, ...options.targetId],
        display: '',
        active: filters.targetId !== '',
      },
      {
        key: 'rangeId',
        label: 'Polígono',
        value: filters.rangeId,
        defaultValue: '',
        options: [{ value: '', label: 'Todos' }, ...options.rangeId],
        display: '',
        active: filters.rangeId !== '',
      },
      {
        key: 'period',
        label: 'Período',
        value: filters.period,
        defaultValue: DEFAULT_PERIOD,
        options: PERIODS.map((period) => ({ value: period, label: PERIOD_LABELS[period] })),
        display: '',
        active: filters.period !== DEFAULT_PERIOD,
      },
    ] satisfies FilterDefinition[]
  ).map((definition) => ({
    ...definition,
    display: definition.display || optionLabel(definition.options, definition.value),
  }));

  const sheetKey = searchParams.get(SHEET_PARAM);
  const sheet = isDesktop ? undefined : definitions.find((item) => item.key === sheetKey);

  function setFilter(definition: FilterDefinition, value: string) {
    setSearchParams(
      (params) => {
        const name = FILTER_PARAMS[definition.key];
        if (value === definition.defaultValue) params.delete(name);
        else params.set(name, value);
        params.delete(SHEET_PARAM);
        return params;
      },
      { replace: true },
    );
  }

  function openSheet(key: FilterKey) {
    setSearchParams(
      (params) => {
        params.set(SHEET_PARAM, key);
        return params;
      },
      { state: OPENED_FROM_SCREEN },
    );
  }

  function closeSheet() {
    if ((state as typeof OPENED_FROM_SCREEN | null)?.fromScreen) {
      navigate(-1);
      return;
    }
    setSearchParams(
      (params) => {
        params.delete(SHEET_PARAM);
        return params;
      },
      { replace: true },
    );
  }

  function clearFilters() {
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  function showAllHistory() {
    setSearchParams(
      (params) => {
        params.set(FILTER_PARAMS.period, 'todo');
        return params;
      },
      { replace: true },
    );
  }

  const filterControls = isDesktop ? (
    <Card as="section" aria-label="Filtros" className={styles.filters}>
      {definitions.map((definition) => (
        <Field key={definition.key} label={definition.label}>
          <Select
            value={definition.value}
            onChange={(event) => setFilter(definition, event.target.value)}
          >
            {definition.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      ))}
    </Card>
  ) : (
    <ChipGroup role="group" aria-label="Filtros">
      {definitions.map((definition) => (
        <Chip
          key={definition.key}
          variant="filter"
          selected={definition.active}
          aria-haspopup="dialog"
          onClick={() => openSheet(definition.key)}
        >
          {definition.label}: <b className={styles.chipValue}>{definition.display}</b>
        </Chip>
      ))}
    </ChipGroup>
  );

  const filterSheet = (
    <FilterSheet
      open={sheet !== undefined}
      title={sheet?.label ?? ''}
      options={sheet?.options ?? []}
      value={sheet?.value ?? ''}
      onSelect={(value) => sheet && setFilter(sheet, value)}
      onClose={closeSheet}
    />
  );

  // --- Sin datos con estos filtros -----------------------------------------------------------

  if (current.rounds === 0) {
    return header(
      <>
        {filterControls}
        <EmptyState
          icon={<SearchX />}
          title="Sin datos para estos filtros"
          text={
            filters.period === 'todo'
              ? 'Probá con otros filtros.'
              : `No hay rondas en ${PERIOD_LABELS[filters.period].toLocaleLowerCase('es-AR')} con estos filtros.`
          }
          action={
            hasActiveFilters(filters) ? (
              <Button onClick={clearFilters}>Limpiar filtros</Button>
            ) : (
              <Button onClick={showAllHistory}>Ver todo el historial</Button>
            )
          }
        />
        {filterSheet}
      </>,
    );
  }

  // --- KPIs ----------------------------------------------------------------------------------

  const tileSize = isDesktop ? 'lg' : 'md';
  const kpis = (
    <section aria-label="Indicadores" className={styles.kpis}>
      <MetricTile
        label={isDesktop ? 'Promedio por tiro' : 'Prom./tiro'}
        value={current.averagePerShot === null ? '—' : formatDecimal(current.averagePerShot)}
        accent={current.averagePerShot !== null}
        size={tileSize}
        {...deltaProps(describeDelta(deltas.averagePerShot, formatDecimal))}
      />
      <MetricTile
        label="Tamaño de grupo"
        value={current.groupSize === null ? '—' : measureValue(current.groupSize)}
        unit={current.groupSize === null ? undefined : unit}
        size={tileSize}
        {...deltaProps(
          describeDelta(deltas.groupSize, (value) => `${measureValue(value)} ${unit}`, true),
        )}
      />
      <MetricTile
        label={isDesktop ? 'Desvío del PMI' : 'Desvío PMI'}
        value={current.mpiOffset === null ? '—' : measureValue(current.mpiOffset)}
        unit={current.mpiOffset === null ? undefined : unit}
        size={tileSize}
        help={
          current.mpiOffset === null
            ? undefined
            : current.mpiClock === null
              ? 'Centrado'
              : `Tendencia hacia las ${current.mpiClock} h`
        }
      />
      <MetricTile
        label="Disparos"
        value={formatInteger(current.shots)}
        size={tileSize}
        help={`${formatInteger(current.sessions)} ${current.sessions === 1 ? 'sesión' : 'sesiones'} · ${formatInteger(current.rounds)} ${current.rounds === 1 ? 'ronda' : 'rondas'}`}
      />
    </section>
  );

  if (report.sessions.length < 2) {
    return header(
      <>
        {filterControls}
        {kpis}
        <Card className={styles.fewData}>
          <TrendingUp aria-hidden="true" className={styles.fewDataIcon} />
          <p>Con dos sesiones o más vas a ver la evolución en gráficos.</p>
        </Card>
        {filterSheet}
      </>,
    );
  }

  // --- Gráficos ------------------------------------------------------------------------------

  const scorePoints: ChartPoint[] = report.sessions.flatMap(({ session, stats }) =>
    stats.averagePerShot === null
      ? []
      : [
          {
            key: session.id,
            axisLabel: formatDayMonth(session.date),
            value: stats.averagePerShot,
            label: formatDecimal(stats.averagePerShot),
          },
        ],
  );
  const groupPoints: ChartPoint[] = report.sessions.flatMap(({ session, stats }) =>
    stats.groupSize === null
      ? []
      : [
          {
            key: session.id,
            axisLabel: formatDayMonth(session.date),
            value: toDisplay(stats.groupSize),
            label: measureValue(stats.groupSize),
          },
        ],
  );
  const chartHeight = isDesktop ? CHART_HEIGHT.desktop : CHART_HEIGHT.mobile;
  const distanceNote =
    report.distanceM === null ? 'todas las distancias' : `a ${formatDecimal(report.distanceM)} m`;

  const charts = (
    <div className={styles.charts}>
      <Card as="section" className={styles.chartCard} aria-labelledby="chart-score">
        <div className={styles.chartHeader}>
          <h2 id="chart-score" className={styles.chartTitle}>
            Puntaje promedio por tiro
          </h2>
          <span className={styles.chartNote}>Por sesión · {distanceNote}</span>
        </div>
        {scorePoints.length > 0 ? (
          <LineChart
            title="Puntaje promedio por tiro"
            points={scorePoints}
            formatTick={formatDecimal}
            height={chartHeight}
          />
        ) : (
          <p className={styles.chartEmpty}>Estas rondas no tienen puntaje.</p>
        )}
      </Card>
      <Card as="section" className={styles.chartCard} aria-labelledby="chart-group">
        <div className={styles.chartHeader}>
          <h2 id="chart-group" className={styles.chartTitle}>
            Tamaño de grupo ({unit})
          </h2>
          <span className={styles.chartNote}>Menor es mejor</span>
        </div>
        {groupPoints.length > 0 ? (
          <LineChart
            title={`Tamaño de grupo por sesión en ${unit}`}
            points={groupPoints}
            formatTick={formatDecimal}
            height={chartHeight}
          />
        ) : (
          <p className={styles.chartEmpty}>
            Ninguna de estas rondas tiene dos impactos o más marcados.
          </p>
        )}
      </Card>
    </div>
  );

  // --- Por munición (mobile) -----------------------------------------------------------------

  const byAmmunition =
    !isDesktop && report.byAmmunition.length > 1 ? (
      <Card as="section" aria-labelledby="by-ammunition" className={styles.chartCard}>
        <h2 id="by-ammunition" className={styles.chartTitle}>
          Por munición
        </h2>
        <AmmunitionComparison
          items={report.byAmmunition.map(({ ammunitionId, stats }) => {
            const ammunition = ready.ammunition.find((item) => item.id === ammunitionId);
            return {
              id: ammunitionId,
              name: ammunition ? ammunitionName(ammunition) : '—',
              average: stats.averagePerShot,
              summary: [
                stats.averagePerShot === null ? '—' : formatDecimal(stats.averagePerShot),
                stats.groupSize === null ? '—' : formatMeasure(stats.groupSize, measure, units),
              ].join(' · '),
            };
          })}
        />
      </Card>
    ) : null;

  // --- Tabla (desktop) -----------------------------------------------------------------------

  const rows = sortRows(report.sessions, sort);

  function downloadCsv() {
    const csv = performanceCsv(rows, ready!.lookups, measure, units);
    // BOM para que Excel lo abra como UTF-8.
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = csvFileName(today);
    link.click();
    URL.revokeObjectURL(url);
  }

  const columns: DataTableColumn<SessionPerformance>[] = [
    {
      key: 'date',
      header: 'Fecha',
      sortable: true,
      kind: 'primary',
      cell: ({ session }) => (
        <Link to={`/sesiones/${session.id}`} className={cx('num', styles.dateLink)}>
          {formatIsoDate(session.date)}
        </Link>
      ),
    },
    {
      key: 'configuration',
      header: 'Configuración',
      cell: ({ session }) => sessionLabels(session, ready.lookups).title,
    },
    {
      key: 'ammunition',
      header: 'Munición',
      kind: 'muted',
      cell: ({ session }) => sessionLabels(session, ready.lookups).ammunition,
    },
    {
      key: 'distance',
      header: 'Distancia',
      kind: 'numeric',
      cell: ({ distances }) => formatDistances(distances),
    },
    {
      key: 'shots',
      header: 'Disparos',
      sortable: true,
      kind: 'numeric',
      cell: ({ stats }) => formatInteger(stats.shots),
    },
    {
      key: 'averagePerShot',
      header: 'Prom./tiro',
      sortable: true,
      kind: 'numeric',
      cell: ({ stats }) =>
        stats.averagePerShot === null ? '—' : <b>{formatDecimal(stats.averagePerShot)}</b>,
    },
    {
      key: 'groupSize',
      header: 'Grupo',
      sortable: true,
      kind: 'numeric',
      cell: ({ stats }) =>
        stats.groupSize === null ? '—' : formatMeasure(stats.groupSize, measure, units),
    },
    {
      key: 'mpiOffset',
      header: 'Desvío PMI',
      sortable: true,
      kind: 'numeric',
      cell: ({ stats }) => formatMpi(stats, measure, units),
    },
  ];

  const table = isDesktop ? (
    <section aria-labelledby="by-session" className={styles.tableSection}>
      <div className={styles.tableHeader}>
        <h2 id="by-session" className={styles.chartTitle}>
          Detalle por sesión
        </h2>
        <Button variant="ghost" onClick={downloadCsv}>
          <Download aria-hidden="true" size={16} />
          Exportar CSV
        </Button>
      </div>
      <DataTable
        aria-label="Detalle por sesión"
        columns={columns}
        rows={rows}
        rowKey={({ session }) => session.id}
        sort={sort}
        onSortChange={(key) => setSort(toggleSort(sort, key as SortKey))}
        onRowClick={({ session }) => navigate(`/sesiones/${session.id}`)}
      />
    </section>
  ) : null;

  return header(
    <>
      {filterControls}
      {kpis}
      {charts}
      {byAmmunition}
      {table}
      {filterSheet}
    </>,
  );
}
