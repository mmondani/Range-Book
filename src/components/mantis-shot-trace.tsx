import { formatDecimal, formatFixed } from '@/lib/format';
import type { MantisShotTrace as ShotTrace } from '@/lib/mantis';
import {
  relativeTrace,
  sampleTime,
  traceRadius,
  traceSegments,
  TRACE_PHASE_LABELS,
} from '@/lib/mantis-trace';
import { useTracePlayback } from '@/hooks/use-trace-playback';
import { MantisTrace } from './mantis-trace';
import { PLAYBACK_SPEEDS, TracePlayback, type PlaybackSpeed } from './trace-playback';
import styles from './mantis-shot-trace.module.css';

export interface MantisShotTraceProps {
  shot: ShotTrace;
  sampleRate: number;
  /** Desde 1. */
  number: number;
  /** Distancia de la ronda, para pasar los ángulos a mm. */
  distanceM: number;
  /** Lado del cuadro, en px. */
  size: number;
  speed: PlaybackSpeed;
  onSpeedChange: (speed: PlaybackSpeed) => void;
}

/**
 * Trayectoria del disparo elegido: el cuadro (`MantisTrace`), la leyenda de las fases y la
 * reproducción en el tiempo. Cambiar de disparo detiene la reproducción y muestra la trayectoria
 * completa.
 */
export function MantisShotTrace({
  shot,
  sampleRate,
  number,
  distanceM,
  size,
  speed,
  onSpeedChange,
}: MantisShotTraceProps) {
  const points = relativeTrace(shot, distanceM);
  const radius = traceRadius(points, shot);
  const playback = useTracePlayback(shot.pk, points.length, sampleRate, PLAYBACK_SPEEDS[speed]);
  const complete = playback.index >= points.length - 1;
  const seconds = sampleTime(playback.index, shot, sampleRate);
  const time = complete
    ? undefined
    : `${seconds < 0 ? '−' : '+'}${formatFixed(Math.abs(seconds), 2)} s`;
  const label =
    `Trayectoria del disparo ${number}: apuntado, presión del gatillo y seguimiento, en mm a ` +
    `${formatDecimal(distanceM)} m. Círculos de ${formatDecimal(radius / 2)} y ` +
    `${formatDecimal(radius)} mm.`;

  return (
    <div className={styles.panel}>
      <MantisTrace
        points={points}
        segments={traceSegments(shot)}
        shotIndex={shot.shotIndex}
        radius={radius}
        upto={playback.index}
        size={size}
        label={label}
        time={time}
      />
      <ul className={styles.legend} aria-label="Fases">
        <li>
          <svg width={22} height={8} aria-hidden="true">
            <path d="M1 4h20" className={styles.hold} />
          </svg>
          {TRACE_PHASE_LABELS.hold}
        </li>
        <li>
          <svg width={22} height={8} aria-hidden="true">
            <path d="M1 4h20" className={styles.pull} />
          </svg>
          {TRACE_PHASE_LABELS.pull}
        </li>
        <li>
          <svg width={22} height={8} aria-hidden="true">
            <path d="M1 4h20" className={styles.follow} />
          </svg>
          {TRACE_PHASE_LABELS.follow}
        </li>
        <li>
          <svg width={14} height={14} viewBox="-7 -7 14 14" aria-hidden="true">
            <path d="M-5-5 5 5M5-5-5 5" className={styles.shot} />
          </svg>
          Disparo
        </li>
      </ul>
      <p className={styles.caption}>
        Movimiento de la boca del arma en mm a la distancia de la ronda ({formatDecimal(distanceM)}{' '}
        m), centrado en el disparo.
      </p>
      <TracePlayback
        playing={playback.playing}
        ended={playback.ended}
        onPlay={playback.play}
        onPause={playback.pause}
        speed={speed}
        onSpeedChange={onSpeedChange}
      />
    </div>
  );
}
