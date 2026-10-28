import { Navigate, type RouteObject } from 'react-router';
import { AppLayout, type LayoutHandle } from '@/components/app-layout';
import { RequireAuth } from '@/components/require-auth';
import { ComponentCatalog } from '@/screens/component-catalog';
import { FirearmItemRoute } from '@/screens/firearm-item-route';
import { FirearmScreen } from '@/screens/firearm-screen';
import { InventoryItemRoute } from '@/screens/inventory-item-route';
import { InventoryScreen } from '@/screens/inventory-screen';
import { LoginScreen } from '@/screens/login-screen';
import { PlaceholderScreen } from '@/screens/placeholder-screen';
import { ProfileScreen } from '@/screens/profile-screen';
import { RoundItemRoute } from '@/screens/round-item-route';
import { SessionDetail } from '@/screens/session-detail';
import { SessionFormScreen } from '@/screens/session-form-screen';
import { SessionsScreen } from '@/screens/sessions-screen';

const FULL_SCREEN: LayoutHandle = { hideBottomNav: true };

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
      {
        // Mobile: la lista o el detalle. Desktop: los dos a la vez (W02).
        path: 'sesiones',
        element: <SessionsScreen />,
        children: [
          {
            path: ':id',
            element: <SessionDetail />,
            // Mobile: la barra "Agregar ronda" reemplaza a la de navegación.
            handle: FULL_SCREEN,
            // Alta y edición de rondas en sheet, con URL propia: "atrás" los cierra.
            children: [
              { path: 'rondas/nueva', element: <RoundItemRoute segment="nueva" /> },
              { path: 'rondas/:roundId/editar', element: <RoundItemRoute segment="editar" /> },
              { path: '*', element: <Navigate to=".." replace /> },
            ],
          },
        ],
      },
      // Formulario de pantalla completa. `sesiones/nueva` le gana a `sesiones/:id`.
      { path: 'sesiones/nueva', element: <SessionFormScreen />, handle: FULL_SCREEN },
      { path: 'sesiones/:id/editar', element: <SessionFormScreen />, handle: FULL_SCREEN },
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
