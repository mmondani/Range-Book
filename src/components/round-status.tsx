import { Check } from 'lucide-react';
import { Badge } from './badge';

/** Estado del análisis de una ronda: *Analizada* o *Sin analizar*. */
export function RoundStatus({ analyzed }: { analyzed: boolean }) {
  return analyzed ? (
    <Badge tone="success" icon={<Check aria-hidden="true" size={14} strokeWidth={3} />}>
      Analizada
    </Badge>
  ) : (
    <Badge tone="warning">Sin analizar</Badge>
  );
}
