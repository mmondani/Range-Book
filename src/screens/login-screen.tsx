import { useState } from 'react';
import { Navigate, useLocation, type Location } from 'react-router';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { GoogleButton } from '@/components/google-button';
import { Logo } from '@/components/logo';
import { useAuth } from '@/hooks/use-auth';
import { APP_NAME } from '@/lib/app-info';
import type { AuthError } from '@/lib/auth';
import styles from './login-screen.module.css';

const HOME = '/sesiones';

function redirectTarget(state: unknown): string {
  const from = (state as { from?: Location } | null)?.from;
  if (!from || from.pathname === '/login') return HOME;
  return `${from.pathname}${from.search}${from.hash}`;
}

function LoginAlert({ error, onRetry }: { error: AuthError; onRetry: () => void }) {
  if (error.kind === 'unauthorized') {
    return (
      <Alert title="Esta cuenta no está autorizada">
        {error.email} no figura en la lista de acceso. Probá con otra cuenta o pedí acceso al
        administrador.
      </Alert>
    );
  }
  const network = error.kind === 'network';
  return (
    <Alert
      title={network ? 'Sin conexión' : 'No se pudo ingresar'}
      action={<Button onClick={onRetry}>Reintentar</Button>}
    >
      {network
        ? 'No pudimos verificar tu cuenta. Revisá la conexión e intentá de nuevo.'
        : 'Ocurrió un error inesperado. Intentá de nuevo.'}
    </Alert>
  );
}

/** M01 / W01 · Login con Google. Solo ingresan los emails autorizados. */
export function LoginScreen() {
  const { state, signIn, retry } = useAuth();
  const location = useLocation();
  const [pending, setPending] = useState(false);

  if (state.status === 'signedIn') {
    return <Navigate to={redirectTarget(location.state)} replace />;
  }

  const loading = pending || state.status === 'loading';
  const error = state.status === 'signedOut' ? state.error : undefined;

  async function run(action: () => Promise<void>) {
    setPending(true);
    try {
      await action();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.screen}>
      <section className={styles.brand}>
        <div className={styles.rings} aria-hidden="true" />
        <div className={styles.cross} aria-hidden="true" />
        <div className={styles.desktopOnly}>
          <Logo withName size={44} />
        </div>
        <div className={styles.pitch}>
          <div className={styles.mobileOnly} aria-hidden="true">
            <Logo size={72} />
          </div>
          <h1 className={`display ${styles.title}`}>
            <span className={styles.mobileOnly}>{APP_NAME}</span>
            <span className={styles.desktopOnly}>Cada disparo, registrado.</span>
          </h1>
          <p className={styles.tagline}>
            <span className={styles.mobileOnly}>
              Tu bitácora de tiro: sesiones, armas, munición y análisis de blancos.
            </span>
            <span className={styles.desktopOnly}>
              Sesiones de tiro, armas y configuraciones, munición y análisis de blancos en un solo
              lugar.
            </span>
          </p>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.form}>
          <div className={`${styles.intro} ${styles.desktopOnly}`}>
            <h2 className="display">Ingresar</h2>
            <p>Usá tu cuenta de Google autorizada.</p>
          </div>
          {error && !loading && <LoginAlert error={error} onRetry={() => run(retry)} />}
          <GoogleButton loading={loading} onClick={() => run(signIn)} />
          <p className={styles.note}>
            <span className={styles.mobileOnly}>Acceso solo para cuentas autorizadas.</span>
            <span className={styles.desktopOnly}>
              Al ingresar, tus datos quedan visibles solo para tu cuenta.
            </span>
          </p>
        </div>
      </section>
    </div>
  );
}
