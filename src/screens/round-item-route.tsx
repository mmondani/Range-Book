import { useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { useSessionDetailOutlet } from '@/hooks/use-sessions';
import { RoundSheet } from './round-sheet';

/**
 * Sheets sobre el detalle de la sesión (rutas hijas de `/sesiones/:id`): alta y edición de una
 * ronda. Si la ronda no existe, vuelve al detalle.
 */
export function RoundItemRoute({ segment }: { segment: 'nueva' | 'editar' }) {
  const { roundId } = useParams();
  const { session, sessions, targets, listPath } = useSessionDetailOutlet();
  const found = session.rounds.find((item) => item.id === roundId);
  // Al eliminarla desde su sheet, la ronda desaparece antes de que el sheet se cierre: se sigue
  // mostrando la que se abrió, así el cierre vuelve atrás en el historial y no redirige.
  const [opened] = useState(found);
  const round = found ?? opened;

  if (segment === 'nueva') {
    return (
      <RoundSheet session={session} sessions={sessions} targets={targets} listPath={listPath} />
    );
  }
  return round ? (
    <RoundSheet
      key={round.id}
      session={session}
      sessions={sessions}
      targets={targets}
      round={round}
      listPath={listPath}
    />
  ) : (
    <Navigate to={listPath} replace />
  );
}
