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

/** Barra inferior en mobile y sidebar en desktop. Al cambiar de ruta, el foco va al `<h1>`. */
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
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const heading = mainRef.current?.querySelector<HTMLElement>('h1');
    if (!heading) return;
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
