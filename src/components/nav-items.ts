import { Crosshair, Package, TrendingUp, User, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Secciones de la navegación principal (barra inferior y sidebar). */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/sesiones', label: 'Sesiones', icon: Crosshair },
  { to: '/rendimiento', label: 'Rendimiento', icon: TrendingUp },
  { to: '/inventario', label: 'Inventario', icon: Package },
  { to: '/perfil', label: 'Perfil', icon: User },
];
