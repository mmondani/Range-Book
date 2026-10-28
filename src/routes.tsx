import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from '@/components/app-layout';
import { RequireAuth } from '@/components/require-auth';
import { ComponentCatalog } from '@/screens/component-catalog';
import { FirearmItemRoute } from '@/screens/firearm-item-route';
import { FirearmScreen } from '@/screens/firearm-screen';
import { InventoryItemRoute } from '@/screens/inventory-item-route';
import { InventoryScreen } from '@/screens/inventory-screen';
import { LoginScreen } from '@/screens/login-screen';
import { PlaceholderScreen } from '@/screens/placeholder-screen';
import { ProfileScreen } from '@/screens/profile-screen';

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
      { path: 'inventario', element: <Navigate to="/inventario/armas" replace /> },
      {
        path: 'inventario/:category',
        element: <InventoryScreen />,
        // Alta y edición en sheet, con URL propia: "atrás" los cierra.
        children: [
          { path: 'nueva', element: <InventoryItemRoute segment="nueva" /> },
          { path: 'nuevo', element: <InventoryItemRoute segment="nuevo" /> },
          { path: ':id/editar', element: <InventoryItemRoute segment="editar" /> },
          { path: '*', element: <Navigate to=".." replace /> },
        ],
      },
      {
        // Va después de `inventario/:category` para que `/inventario/armas/nueva` sea el alta.
        path: 'inventario/armas/:id',
        element: <FirearmScreen />,
        children: [
          { path: 'editar', element: <FirearmItemRoute kind="firearm" segment="editar" /> },
          {
            path: 'modificaciones/nueva',
            element: <FirearmItemRoute kind="modification" segment="nueva" />,
          },
          {
            path: 'modificaciones/:itemId/editar',
            element: <FirearmItemRoute kind="modification" segment="editar" />,
          },
          {
            path: 'configuraciones/nueva',
            element: <FirearmItemRoute kind="configuration" segment="nueva" />,
          },
          {
            path: 'configuraciones/:itemId/editar',
            element: <FirearmItemRoute kind="configuration" segment="editar" />,
          },
          { path: '*', element: <Navigate to=".." replace /> },
        ],
      },
      { path: 'perfil', element: <ProfileScreen /> },
      ...(import.meta.env.DEV ? [{ path: 'componentes', element: <ComponentCatalog /> }] : []),
      { path: '*', element: <Navigate to="/sesiones" replace /> },
    ],
  },
];
