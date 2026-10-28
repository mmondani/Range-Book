import { Plus } from 'lucide-react';
import { NavLink } from 'react-router';
import { cx } from '@/lib/cx';
import { Avatar } from './avatar';
import { LinkButton } from './link-button';
import { Logo } from './logo';
import { NAV_ITEMS } from './nav-items';
import styles from './sidebar.module.css';

export interface SidebarUser {
  displayName: string;
  email: string;
  photoURL?: string | null;
}

export interface SidebarProps {
  user?: SidebarUser | null;
}

/** Navegación lateral de 240 px (≥ 1024 px). */
export function Sidebar({ user }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <Logo withName className={styles.logo} />
      <LinkButton to="/sesiones/nueva" variant="primary">
        <Plus aria-hidden="true" size={18} />
        Nueva sesión
      </LinkButton>
      <nav aria-label="Principal" className={styles.nav}>
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cx(styles.item, isActive && styles.on)}
          >
            <Icon aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      {user && (
        <div className={styles.user}>
          <Avatar name={user.displayName} photoURL={user.photoURL} />
          <span className={styles.userText}>
            <span className={styles.userName}>{user.displayName}</span>
            <span className={styles.userEmail}>{user.email}</span>
          </span>
        </div>
      )}
    </aside>
  );
}
