import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useMatches } from 'react-router';
import { useCurrentUser } from '@/hooks/use-auth';
import { cx } from '@/lib/cx';
import { BottomNav } from './bottom-nav';
import styles from './app-layout.module.css';
import { OfflineBanner } from './offline-banner';
import { Sidebar, type SidebarUser } from './sidebar';

/** `handle` de una ruta que ocupa toda la pantalla en mobile, con su propia barra de acción. */
export interface LayoutHandle {
  hideBottomNav?: boolean;
}

export interface AppLayoutProps {
  /** Por defecto, el usuario con sesión. */
  user?: SidebarUser | null;
}

/**
 * Barra inferior en mobile y sidebar en desktop. Al cambiar de pantalla, el foco va al `<h1>`. Si
 * la ruta cambia pero la pantalla sigue siendo la misma (abrir o cerrar un sheet, cambiar de
 * pestaña), el foco no se mueve. Las rutas con `handle.hideBottomNav` (formularios de pantalla
 * completa) no muestran la barra inferior. Sin conexión, arriba del contenido va `OfflineBanner`.
 */
export function AppLayout({ user }: AppLayoutProps) {
  const currentUser = useCurrentUser();
  const sidebarUser: SidebarUser | null =
    user ??
    (currentUser && {
      displayName: currentUser.displayName ?? currentUser.email ?? '',
      email: currentUser.email ?? '',
      photoURL: currentUser.photoURL,
    });
  const { pathname } = useLocation();
  const hideBottomNav = useMatches().some(
    (match) => (match.handle as LayoutHandle | undefined)?.hideBottomNav === true,
  );
  const mainRef = useRef<HTMLElement>(null);
  const lastHeading = useRef<{ node: HTMLElement | null; text: string | null }>(undefined);

  useEffect(() => {
    const heading = mainRef.current?.querySelector<HTMLElement>('h1') ?? null;
    const text = heading?.textContent ?? null;
    const last = lastHeading.current;
    lastHeading.current = { node: heading, text };
    // React puede reusar el mismo `<h1>` entre pantallas: también se compara el texto.
    const sameScreen = last?.node === heading && last.text === text;
    if (!last || sameScreen || !heading) return;
    heading.tabIndex = -1;
    heading.focus();
  }, [pathname]);

  return (
    <div className={styles.layout}>
      <Sidebar user={sidebarUser} />
      <main ref={mainRef} className={cx(styles.main, hideBottomNav && styles.noNav)}>
        <OfflineBanner />
        <Outlet />
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
