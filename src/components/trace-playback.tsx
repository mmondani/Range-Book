import { Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from './button';
import { SegmentedControl } from './segmented-control';
import styles from './trace-playback.module.css';

export type PlaybackSpeed = 'slow' | 'real';

/** Muestras por segundo respecto del tiempo real. */
export const PLAYBACK_SPEEDS: Record<PlaybackSpeed, number> = { slow: 0.1, real: 1 };

const SPEED_OPTIONS = [
  { value: 'slow' as const, label: 'Lenta' },
  { value: 'real' as const, label: 'Real' },
];

export interface TracePlaybackProps {
  playing: boolean;
  /** Terminó una reproducción: el botón dice "Repetir". */
  ended: boolean;
  onPlay: () => void;
  onPause: () => void;
  speed: PlaybackSpeed;
  onSpeedChange: (speed: PlaybackSpeed) => void;
}

/**
 * Reproducir / Pausar / Repetir la trayectoria y su velocidad: Lenta (1/10, por defecto) o Real. La
 * reproducción la inicia el usuario; con `prefers-reduced-motion` se mantiene (es el contenido).
 */
export function TracePlayback({
  playing,
  ended,
  onPlay,
  onPause,
  speed,
  onSpeedChange,
}: TracePlaybackProps) {
  const Icon = playing ? Pause : ended ? RotateCcw : Play;
  return (
    <div className={styles.controls}>
      <Button onClick={playing ? onPause : onPlay} className={styles.play}>
        <Icon aria-hidden="true" size={18} />
        {playing ? 'Pausar' : ended ? 'Repetir' : 'Reproducir'}
      </Button>
      <SegmentedControl
        aria-label="Velocidad"
        options={SPEED_OPTIONS}
        value={speed}
        onChange={onSpeedChange}
        className={styles.speed}
      />
    </div>
  );
}
