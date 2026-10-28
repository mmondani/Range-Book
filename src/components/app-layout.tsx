import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useCurrentUser } from '@/hooks/use-auth';
import { BottomNav } from './bottom-nav';
import styles from './app-layout.module.css';
import { Sidebar, type SidebarUser } from './sidebar';

export interface AppLayoutProps {
  /** Por defecto, el usuario con sesión. */
  user?: SidebarUser | null;
}

/**
 * Barra inferior en mobile y sidebar en desktop. Al cambiar de pantalla, el foco va al `<h1>`. Si
 * la ruta cambia pero la pantalla sigue siendo la misma (abrir o cerrar un sheet, cambiar de
 * pestaña), el foco no se mueve.
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
      <main ref={mainRef} className={styles.main}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
