import { Crosshair } from 'lucide-react';
import { useState } from 'react';
import { useIsDesktop } from '@/hooks/use-media-query';
import type { ChartPoint } from '@/lib/chart';
import { cx } from '@/lib/cx';
import { formatInteger } from '@/lib/format';
import { measureUnit, type Measure } from '@/lib/performance';
import type { Round } from '@/lib/sessions';
import {
  analyzedRounds,
  defaultEvolutionMeasure,
  EVOLUTION_METRICS,
  scatterCircle,
  sessionEvolution,
  type EvolutionMetric,
  type EvolutionRound,
} from '@/lib/session-evolution';
import { fromMm, UNIT_DECIMALS, UNIT_SYMBOLS, type Units } from '@/lib/units';
import { EmptyState } from './empty-state';
import { LineChart } from './line-chart';
import { MpiScatter } from './mpi-scatter';
import { ScatterSelection } from './scatter-selection';
import { SegmentedControl } from './segmented-control';
import styles from './session-evolution.module.css';

export interface SessionEvolutionProps {
  rounds: readonly Round[];
  units: Units;
  /** Nivel de los títulos de los gráficos, para no saltear headings. */
  headingLevel: 2 | 3;
  /** El análisis de una ronda ("Ver análisis" de la ronda seleccionada). */
  analysisPath: (roundId: string) => string;
}

const CHART_HEIGHT = { mobile: 180, desktop: 220 };

/** Qué valor de la ronda va en cada gráfico de línea, y su título. */
const SERIES: Record<
  EvolutionMetric,
  { title: string; value: (round: EvolutionRound) => number | null }
> = {
  mpi: { title: 'Desvío del PMI', value: (round) => round.mpiOffset },
  group: { title: 'Tamaño de grupo', value: (round) => round.groupSize },
  radius: { title: 'Radio medio', value: (round) => round.meanRadius },
};

/** La dispersión de cada métrica: título, resumen accesible y leyenda. */
const SCATTER: Record<EvolutionMetric, { title: string; summary: string; caption: string }> = {
  mpi: {
    title: 'PMI de cada ronda',
    summary: 'PMI de cada ronda respecto del centro',
    caption:
      'Cada punto es el PMI de una ronda (X a la derecha, Y hacia arriba); la última, resaltada.',
  },
  group: {
    title: 'Grupo de cada ronda',
    summary: 'Grupo de cada ronda alrededor de su PMI',
    caption:
      'Cada círculo está centrado en el PMI de la ronda y su diámetro es el tamaño de grupo.',
  },
  radius: {
    title: 'Radio medio de cada ronda',
    summary: 'Radio medio de cada ronda alrededor de su PMI',
    caption:
      'Cada círculo está centrado en el PMI de la ronda y su radio es el radio medio: la distancia media de los impactos a ese PMI.',
  },
};

/**
 * Pestaña Evolución del detalle de sesión: PMI, grupo o radio medio de cada ronda analizada, en
 * la unidad del perfil o en MOA. Una ronda seleccionada (en la línea o en la dispersión) queda
 * seleccionada en las tres métricas y en las dos unidades.
 */
export function SessionEvolution({
  rounds,
  units,
  headingLevel,
  analysisPath,
}: SessionEvolutionProps) {
  const isDesktop = useIsDesktop();
  const [metric, setMetric] = useState<EvolutionMetric>('mpi');
  const [measure, setMeasure] = useState<Measure>(() => defaultEvolutionMeasure(rounds));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const analyzed = analyzedRounds(rounds).length;

  if (analyzed === 0) {
    return (
      <EmptyState
        icon={<Crosshair />}
        title="Todavía no hay rondas analizadas"
        text="Analizá los blancos de las rondas para ver cómo evolucionan el PMI, el grupo y el radio medio."
        headingLevel={headingLevel}
      />
    );
  }
  if (analyzed === 1) {
    return <p className={styles.few}>Con dos rondas analizadas o más vas a ver la evolución.</p>;
  }

  const evolution = sessionEvolution(rounds, measure);
  // Si la ronda seleccionada ya no está (se borró su análisis), no hay selección.
  const selected = evolution.find((round) => round.key === selectedId) ?? null;
  const unit = measureUnit(measure, units);
  // En la unidad que se muestra: MOA tal cual; las longitudes, de mm a la del perfil.
  const display = (value: number) => (measure === 'moa' ? value : fromMm(value, units));
  const decimals = measure === 'moa' ? 2 : UNIT_DECIMALS[units];
  const numberFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: decimals });
  const valueFormat = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const series = SERIES[metric];
  const lineRounds = evolution.filter((round) => series.value(round) !== null);
  const points: ChartPoint[] = lineRounds.map((round) => {
    const value = display(series.value(round)!);
    return {
      key: round.key,
      axisLabel: `R${round.number}`,
      name: `Ronda ${round.number}`,
      value,
      label: valueFormat.format(value),
    };
  });
  const lineSelected = selected ? lineRounds.indexOf(selected) : -1;

  const scatter = SCATTER[metric];
  const measureDetail = (round: EvolutionRound) => {
    if (metric === 'group' && round.groupSize !== null) {
      return { short: 'grupo', label: 'Grupo', value: display(round.groupSize) };
    }
    if (metric === 'radius' && round.meanRadius !== null) {
      return { short: 'radio medio', label: 'Radio medio', value: display(round.meanRadius) };
    }
    return null;
  };
  const scatterPoints = evolution.flatMap((round) => {
    if (!round.mpi) return [];
    const radius = scatterCircle(round, metric);
    const measured = measureDetail(round);
    return [
      {
        key: round.key,
        label: String(round.number),
        x: display(round.mpi.x),
        y: display(round.mpi.y),
        radius: radius === null ? null : display(radius),
        detail: measured ? `${measured.short} ${numberFormat.format(measured.value)}` : undefined,
      },
    ];
  });
  const selectionDetail = (round: EvolutionRound) => {
    const parts = [];
    if (round.mpi) {
      parts.push(
        `PMI (${valueFormat.format(display(round.mpi.x))}; ${valueFormat.format(display(round.mpi.y))})`,
      );
    }
    const measured = measureDetail(round);
    if (measured) parts.push(`${measured.label} ${valueFormat.format(measured.value)}`);
    return `${parts.join(' · ')} ${unit}`;
  };

  return (
    <div className={styles.evolution}>
      <div className={styles.header}>
        <span className={styles.note}>
          {`Por ronda analizada · ${formatInteger(analyzed)} de ${formatInteger(rounds.length)}`}
        </span>
        <SegmentedControl
          aria-label="Unidad"
          options={[
            { value: 'length', label: UNIT_SYMBOLS[units] },
            { value: 'moa', label: 'MOA' },
          ]}
          value={measure}
          onChange={setMeasure}
          className={styles.unit}
        />
      </div>
      <SegmentedControl
        aria-label="Qué graficar"
        options={EVOLUTION_METRICS}
        value={metric}
        onChange={setMetric}
      />

      <Heading className={styles.chartTitle}>
        {series.title} ({unit})
      </Heading>
      {points.length > 0 ? (
        <LineChart
          title={`${series.title} por ronda en ${unit}`}
          points={points}
          height={isDesktop ? CHART_HEIGHT.desktop : CHART_HEIGHT.mobile}
          formatTick={(value) => numberFormat.format(value)}
          noun="rondas"
          selectedIndex={lineSelected === -1 ? null : lineSelected}
          onSelect={(index) => setSelectedId(index === null ? null : points[index]!.key)}
        />
      ) : (
        <p className={styles.few}>Ninguna de estas rondas tiene dos impactos o más marcados.</p>
      )}

      <Heading className={cx(styles.chartTitle, styles.scatterTitle)}>{scatter.title}</Heading>
      <MpiScatter
        // Cambiar de métrica o de unidad vuelve a 1× (la selección se mantiene).
        key={`${metric}-${measure}`}
        title={scatter.summary}
        points={scatterPoints}
        unit={unit}
        format={(value) => numberFormat.format(value)}
        selectedKey={selected?.key ?? null}
        onSelect={setSelectedId}
      />
      <ScatterSelection
        round={
          selected && {
            number: selected.number,
            detail: selectionDetail(selected),
            href: analysisPath(selected.key),
          }
        }
      />
      <p className={styles.caption}>{scatter.caption}</p>
    </div>
  );
}
