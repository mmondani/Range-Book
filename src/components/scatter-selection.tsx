import { Link } from 'react-router';
import styles from './scatter-selection.module.css';

export interface ScatterSelectionProps {
  /** La ronda seleccionada, o `null` si no hay. */
  round: {
    number: number;
    /** "PMI (1,5; −8,4) · Grupo 41,0 mm". */
    detail: string;
    /** El análisis de la ronda. */
    href: string;
  } | null;
}

/**
 * Debajo de la dispersión: la ronda seleccionada con sus valores y el link a su análisis. Reserva
 * su alto para que el contenido no salte al seleccionar.
 */
export function ScatterSelection({ round }: ScatterSelectionProps) {
  return (
    <div role="status" className={styles.selection}>
      {round ? (
        <>
          <span className={styles.text}>
            <span className={styles.title}>Ronda {round.number}</span>
            <span className={styles.detail}>{round.detail}</span>
          </span>
          <Link
            to={round.href}
            className={styles.link}
            aria-label={`Ver análisis de la ronda ${round.number}`}
          >
            Ver análisis
          </Link>
        </>
      ) : (
        <span className={styles.hint}>
          Tocá un punto para ver esa ronda. Pellizcá el gráfico para acercarlo.
        </span>
      )}
    </div>
  );
}
