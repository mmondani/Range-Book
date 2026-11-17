import { useCallback, useEffect, useRef, useState } from 'react';

export interface TracePlayback {
  /** Última muestra que se dibuja: la última de la trayectoria si no se está reproduciendo. */
  index: number;
  playing: boolean;
  /** Terminó una reproducción (el botón dice "Repetir"). */
  ended: boolean;
  play: () => void;
  pause: () => void;
}

/**
 * Reproduce una trayectoria en el tiempo (`requestAnimationFrame`): avanza `sampleRate × speed`
 * muestras por segundo. Arranca mostrando la trayectoria completa. Cambiar la velocidad mientras
 * se reproduce sigue desde donde está. Al cambiar `traceKey` (otro disparo) se detiene y vuelve a
 * mostrar la trayectoria completa.
 */
export function useTracePlayback(
  traceKey: string | number,
  length: number,
  sampleRate: number,
  speed: number,
): TracePlayback {
  const last = Math.max(length - 1, 0);
  const initial = { key: traceKey, index: last, playing: false, ended: false };
  const [state, setState] = useState(initial);
  // Otro disparo: se reinicia (patrón de "estado derivado de las props").
  if (state.key !== traceKey) setState(initial);
  // Muestra actual, para seguir desde ahí al cambiar la velocidad (sin reiniciar el efecto en
  // cada cuadro).
  const index = useRef(state.index);
  const indexKey = useRef(traceKey);

  useEffect(() => {
    if (!state.playing) return;
    const start = performance.now();
    const from = index.current;
    let frame = 0;
    const tick = (now: number) => {
      const next = from + Math.max(0, Math.floor(((now - start) / 1000) * sampleRate * speed));
      if (next >= last) {
        index.current = last;
        setState((current) => ({ ...current, index: last, playing: false, ended: true }));
        return;
      }
      index.current = next;
      setState((current) => (current.index === next ? current : { ...current, index: next }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state.playing, sampleRate, speed, last]);

  const play = useCallback(() => {
    // Al terminar, con la trayectoria completa a la vista o con otro disparo, empieza de cero.
    if (indexKey.current !== traceKey || index.current >= last) index.current = 0;
    indexKey.current = traceKey;
    setState((current) => ({ ...current, index: index.current, playing: true, ended: false }));
  }, [last, traceKey]);

  const pause = useCallback(() => {
    setState((current) => ({ ...current, playing: false }));
  }, []);

  const current = state.key === traceKey ? state : initial;
  return { index: current.index, playing: current.playing, ended: current.ended, play, pause };
}
