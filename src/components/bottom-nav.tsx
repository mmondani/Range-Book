import { NavLink } from 'react-router';
import { cx } from '@/lib/cx';
import styles from './bottom-nav.module.css';
import { NAV_ITEMS } from './nav-items';

/** Barra inferior de navegación (< 1024 px). */
export function BottomNav() {
  return (
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
  );
}
