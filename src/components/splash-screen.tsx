import { Logo } from './logo';
import styles from './splash-screen.module.css';

/** Pantalla mientras se resuelve la sesión al abrir la app. */
export function SplashScreen() {
  return (
    <div className={styles.splash} role="status">
      <Logo size={56} />
      <span className="visually-hidden">Cargando…</span>
    </div>
  );
}
