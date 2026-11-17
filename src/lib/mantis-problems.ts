/** Diagnóstico de MantisX que significa "sin problema". */
export const GREAT_SHOT = 'GREAT SHOT';

const PROBLEMS: Record<string, string> = {
  [GREAT_SHOT]: 'Buen disparo',
  'PUSHING FORWARD': 'Empujar hacia adelante',
  'SLAPPING TRIGGER': 'Golpear el gatillo',
  'TIGHTENING FINGERS': 'Cerrar los dedos',
  'TIGHTENING GRIP': 'Apretar el agarre',
  HEELING: 'Empujar con la palma',
  'TOO LITTLE TRIGGER FINGER': 'Poco dedo en el gatillo',
  'TOO MUCH TRIGGER FINGER': 'Mucho dedo en el gatillo',
  PUSHING: 'Empujar (anticipar el retroceso)',
  'BREAKING WRIST UP': 'Quebrar la muñeca hacia arriba',
};

/** Diagnóstico en castellano. Los que no se conocen se muestran tal cual llegan de MantisX. */
export function problemLabel(problem: string): string {
  return PROBLEMS[problem.trim().toUpperCase()] ?? (problem.trim() || 'Sin diagnóstico');
}
