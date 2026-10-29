import { ChevronRight, Download, Info, LogOut, Share } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Avatar } from '@/components/avatar';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Field } from '@/components/field';
import { SegmentedControl, type SegmentOption } from '@/components/segmented-control';
import { Skeleton } from '@/components/skeleton';
import { StatTile } from '@/components/stat-tile';
import { useAuth, useCurrentUser } from '@/hooks/use-auth';
import { useInstall } from '@/hooks/use-install';
import { useProfile, useProfileSummary, useUnits, type SummaryState } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useToast } from '@/hooks/use-toast';
import { APP_NAME } from '@/lib/app-info';
import { formatInteger } from '@/lib/format';
import type { Preferences, ProfileSummary } from '@/lib/profile';
import type { ThemePreference } from '@/lib/theme';
import type { Units } from '@/lib/units';
import styles from './profile-screen.module.css';

const UNIT_OPTIONS: ReadonlyArray<SegmentOption<Units>> = [
  { value: 'mm', label: 'Milímetros' },
  { value: 'in', label: 'Pulgadas' },
];

const THEME_OPTIONS: ReadonlyArray<SegmentOption<ThemePreference>> = [
  { value: 'dark', label: 'Oscuro' },
  { value: 'light', label: 'Claro' },
  { value: 'system', label: 'Sistema' },
];

const SUMMARY_TILES: ReadonlyArray<{ key: keyof ProfileSummary; label: string }> = [
  { key: 'sessions', label: 'Sesiones' },
  { key: 'shots', label: 'Disparos' },
  { key: 'firearms', label: 'Armas' },
];

function summaryValue(state: SummaryState, key: keyof ProfileSummary): ReactNode {
  if (state.status === 'ready') return formatInteger(state.summary[key]);
  if (state.status === 'error') return '—';
  return <Skeleton shape="text" width={48} />;
}

/**
 * M11 · Perfil: cuenta, resumen, preferencias (unidades y tema), instalar, versión y cerrar
 * sesión.
 */
export function ProfileScreen() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const { profile, updatePreferences } = useProfile();
  const { preference: theme } = useTheme();
  const units = useUnits();
  const summary = useProfileSummary();
  const toast = useToast();
  const [signingOut, setSigningOut] = useState(false);
  const install = useInstall();
  const [iosHelpOpen, setIosHelpOpen] = useState(false);

  const email = user?.email ?? '';
  const name = user?.displayName || profile?.displayName || email;

  function savePreferences(preferences: Partial<Preferences>) {
    updatePreferences(preferences).catch(() =>
      toast.show({ message: 'No se pudo guardar la preferencia', tone: 'error' }),
    );
  }

  function handleInstall() {
    if (install.method === 'ios') setIosHelpOpen(true);
    else install.prompt().catch(() => {});
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      setSigningOut(false);
      toast.show({ message: 'No se pudo cerrar la sesión', tone: 'error' });
    }
  }

  return (
    <div className={styles.screen}>
      <h1 className={`display ${styles.title}`}>Perfil</h1>

      <Card as="section" aria-label="Cuenta" className={styles.account}>
        <Avatar name={name} photoURL={user?.photoURL} size={60} className={styles.avatar} />
        <div className={styles.accountText}>
          <span className={styles.name}>{name}</span>
          <span className={styles.email}>{email}</span>
          <span className={styles.provider}>Cuenta de Google</span>
        </div>
      </Card>

      <section aria-label="Resumen" className={styles.summary}>
        {SUMMARY_TILES.map(({ key, label }) => (
          <Card key={key} padded={false} className={styles.summaryCard}>
            <StatTile label={label} value={summaryValue(summary, key)} />
          </Card>
        ))}
      </section>

      <section className={styles.group} aria-labelledby="profile-preferences">
        <h2 id="profile-preferences" className="eyebrow">
          Preferencias
        </h2>
        <Card className={styles.preferences}>
          <Field label="Unidades de medida" kind="group">
            <SegmentedControl
              options={UNIT_OPTIONS}
              value={units}
              onChange={(next) => savePreferences({ units: next })}
            />
          </Field>
          <Field label="Tema" kind="group">
            <SegmentedControl
              options={THEME_OPTIONS}
              value={theme}
              onChange={(next) => savePreferences({ theme: next })}
            />
          </Field>
        </Card>
      </section>

      <section className={styles.group} aria-labelledby="profile-app">
        <h2 id="profile-app" className="eyebrow">
          Aplicación
        </h2>
        <Card padded={false}>
          {install.method && (
            <button
              type="button"
              className={`${styles.row} ${styles.rowButton}`}
              onClick={handleInstall}
            >
              <Download aria-hidden="true" className={styles.installIcon} />
              <span className={styles.rowLabel}>Instalar en el dispositivo</span>
              <ChevronRight aria-hidden="true" size={18} className={styles.rowValue} />
            </button>
          )}
          <div className={styles.row}>
            <Info aria-hidden="true" className={styles.rowIcon} />
            <span className={styles.rowLabel}>Versión</span>
            <span className={`num ${styles.rowValue}`}>{__APP_VERSION__}</span>
          </div>
        </Card>
      </section>

      <Button variant="danger" block loading={signingOut} onClick={handleSignOut}>
        <LogOut aria-hidden="true" size={20} />
        Cerrar sesión
      </Button>

      {/* Solo informativo, sin ruta propia: en iOS no hay botón "atrás" del sistema. */}
      <BottomSheet
        open={iosHelpOpen}
        onClose={() => setIosHelpOpen(false)}
        title="Instalar en el iPhone"
        footer={
          <Button variant="primary" onClick={() => setIosHelpOpen(false)}>
            Entendido
          </Button>
        }
      >
        <ol className={styles.steps}>
          <li>
            En Safari, tocá <strong>Compartir</strong> <Share aria-hidden="true" size={18} />.
          </li>
          <li>
            Elegí <strong>Agregar a inicio</strong>.
          </li>
          <li>
            Tocá <strong>Agregar</strong>. {APP_NAME} queda en la pantalla de inicio y se abre como
            una app.
          </li>
        </ol>
      </BottomSheet>
    </div>
  );
}
