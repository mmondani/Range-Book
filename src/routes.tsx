import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from '@/components/app-layout';
import { RequireAuth } from '@/components/require-auth';
import { ComponentCatalog } from '@/screens/component-catalog';
import { LoginScreen } from '@/screens/login-screen';
import { PlaceholderScreen } from '@/screens/placeholder-screen';

export const routes: RouteObject[] = [
  { path: 'login', element: <LoginScreen /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
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
