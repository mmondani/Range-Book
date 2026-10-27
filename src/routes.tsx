import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from '@/components/app-layout';
import { ComponentCatalog } from '@/screens/component-catalog';
import { PlaceholderScreen } from '@/screens/placeholder-screen';

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/sesiones" replace /> },
      { path: 'sesiones/*', element: <PlaceholderScreen title="Sesiones" /> },
      { path: 'rendimiento', element: <PlaceholderScreen title="Rendimiento" /> },
      { path: 'inventario/*', element: <PlaceholderScreen title="Inventario" /> },
      { path: 'perfil', element: <PlaceholderScreen title="Perfil" /> },
      ...(import.meta.env.DEV ? [{ path: 'componentes', element: <ComponentCatalog /> }] : []),
      { path: '*', element: <Navigate to="/sesiones" replace /> },
    ],
  },
];
