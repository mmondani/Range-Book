import type { Calibration, Pixel } from '@/lib/calibration';
import type { ImpactTag, LabeledImpact } from './dataset';

/** Impactos marcados de una foto, con el historial para deshacer. */
export interface LabelHistory {
  impacts: LabeledImpact[];
  past: LabeledImpact[][];
}

export function labelHistory(impacts: LabeledImpact[] = []): LabelHistory {
  return { impacts, past: [] };
}

function commit(history: LabelHistory, impacts: LabeledImpact[]): LabelHistory {
  return { impacts, past: [...history.past, history.impacts] };
}

export function addLabeled(history: LabelHistory, at: Pixel): LabelHistory {
  return commit(history, [...history.impacts, { x: at.x, y: at.y, tags: [] }]);
}

export function removeLabeled(history: LabelHistory, index: number): LabelHistory {
  return commit(
    history,
    history.impacts.filter((_, i) => i !== index),
  );
}

/** Pone o saca una etiqueta de un impacto. */
export function toggleTag(history: LabelHistory, index: number, tag: ImpactTag): LabelHistory {
  return commit(
    history,
    history.impacts.map((impact, i) => {
      if (i !== index) return impact;
      const tags = impact.tags.includes(tag)
        ? impact.tags.filter((item) => item !== tag)
        : [...impact.tags, tag];
      return { ...impact, tags };
    }),
  );
}

/** Reemplaza lo marcado por la propuesta de la detección (sin etiquetas). Se puede deshacer. */
export function applyProposal(history: LabelHistory, proposal: readonly Pixel[]): LabelHistory {
  return commit(
    history,
    proposal.map(({ x, y }) => ({ x, y, tags: [] })),
  );
}

export function undoLabels(history: LabelHistory): LabelHistory {
  const previous = history.past[history.past.length - 1];
  return previous ? { impacts: previous, past: history.past.slice(0, -1) } : history;
}

/** Aviso cuando los impactos marcados no coinciden con los disparos de la ronda. */
export function countWarning(impacts: number, shots: number | null): string | null {
  if (shots === null || impacts === shots) return null;
  return impacts < shots
    ? `Faltan ${shots - impacts} impactos: si dos agujeros se superponen, marcá uno por bala.`
    : `Sobran ${impacts - shots} impactos: puede haber agujeros de otra ronda (etiquetalos).`;
}

/**
 * La misma calibración en una copia de la foto escalada por `sx` × `sy` (por ejemplo, la foto
 * comprimida que guarda la app). La forma no cambia si la escala es pareja, como al reducir sin
 * deformar.
 */
export function scaleCalibration(calibration: Calibration, sx: number, sy: number): Calibration {
  const scale = ({ x, y }: Pixel) => ({ x: x * sx, y: y * sy });
  const size = { width: calibration.width * sx, height: calibration.height * sy };
  if (calibration.kind === 'ring') {
    return {
      ...calibration,
      ...size,
      center: scale(calibration.center),
      edge: scale(calibration.edge),
    };
  }
  return {
    ...calibration,
    ...size,
    center: scale(calibration.center),
    a: scale(calibration.a),
    b: scale(calibration.b),
  };
}
