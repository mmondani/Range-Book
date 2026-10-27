import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { ToastProvider } from '@/components/toast-provider';
import { useTheme } from '@/hooks/use-theme';
import { routes } from '@/routes';

export function App() {
  const [router] = useState(() => createBrowserRouter(routes));
  // Mantiene `data-theme` sincronizado (por ejemplo, si cambia el tema del sistema).
  useTheme();

  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  );
}
