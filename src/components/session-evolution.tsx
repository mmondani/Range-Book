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
  sessionEvolution,
  type EvolutionMetric,
  type EvolutionRound,
} from '@/lib/session-evolution';
import { fromMm, UNIT_DECIMALS, UNIT_SYMBOLS, type Units } from '@/lib/units';
import { EmptyState } from './empty-state';
import { LineChart } from './line-chart';
import { MpiScatter } from './mpi-scatter';
import { SegmentedControl } from './segmented-control';
import styles from './session-evolution.module.css';

export interface SessionEvolutionProps {
  rounds: readonly Round[];
  units: Units;
  /** Nivel de los títulos de los gráficos, para no saltear headings. */
  headingLevel: 2 | 3;
}

const CHART_HEIGHT = { mobile: 180, desktop: 220 };

/** Qué valor de la ronda va en cada gráfico de línea, y su título. */
const SERIES: Record<
  EvolutionMetric,
  { title: string; value: (round: EvolutionRound) => number | null }
> = {
  mpi: { title: 'Desvío del PMI', value: (round) => round.mpiOffset },
  group: { title: 'Tamaño de grupo', value: (round) => round.groupSize },
  center: { title: 'Distancia al centro', value: (round) => round.meanDistance },
};

/**
 * Pestaña Evolución del detalle de sesión: PMI, grupo o distancia al centro de cada ronda
 * analizada, en la unidad del perfil o en MOA.
 */
export function SessionEvolution({ rounds, units, headingLevel }: SessionEvolutionProps) {
  const isDesktop = useIsDesktop();
  const [metric, setMetric] = useState<EvolutionMetric>('mpi');
  const [measure, setMeasure] = useState<Measure>(() => defaultEvolutionMeasure(rounds));
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const analyzed = analyzedRounds(rounds).length;

  if (analyzed === 0) {
    return (
      <EmptyState
        icon={<Crosshair />}
        title="Todavía no hay rondas analizadas"
        text="Analizá los blancos de las rondas para ver cómo evolucionan el PMI, el grupo y la distancia al centro."
        headingLevel={headingLevel}
      />
    );
  }
  if (analyzed === 1) {
    return <p className={styles.few}>Con dos rondas analizadas o más vas a ver la evolución.</p>;
  }

  const evolution = sessionEvolution(rounds, measure);
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
  const points: ChartPoint[] = evolution.flatMap((round) => {
    const value = series.value(round);
    return value === null
      ? []
      : [
          {
            key: round.key,
            axisLabel: `R${round.number}`,
            value: display(value),
            label: valueFormat.format(display(value)),
          },
        ];
  });

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
        />
      ) : (
        <p className={styles.few}>Ninguna de estas rondas tiene dos impactos o más marcados.</p>
      )}

      {metric === 'mpi' && (
        <>
          <Heading className={cx(styles.chartTitle, styles.scatterTitle)}>
            PMI de cada ronda
          </Heading>
          <MpiScatter
            title="PMI de cada ronda respecto del centro"
            points={evolution.flatMap((round) =>
              round.mpi
                ? [
                    {
                      key: round.key,
                      label: String(round.number),
                      x: display(round.mpi.x),
                      y: display(round.mpi.y),
                    },
                  ]
                : [],
            )}
            unit={unit}
            format={(value) => numberFormat.format(value)}
          />
          <p className={styles.caption}>
            Cada punto es el PMI de una ronda (X a la derecha, Y hacia arriba); la última,
            resaltada.
          </p>
        </>
      )}
    </div>
  );
}
