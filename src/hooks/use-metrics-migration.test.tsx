import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthState } from '@/hooks/use-auth';
import { AuthContext } from '@/hooks/use-auth';
import { SessionContext } from '@/hooks/use-sessions';
import { ANA } from '@/test/fake-auth';
import { createFakeSessions } from '@/test/fake-sessions';
import { resetMetricsMigration, useMetricsMigration } from './use-metrics-migration';

function setup(state: AuthState) {
  const { repository } = createFakeSessions();
  const auth = { state, signIn: vi.fn(), signOut: vi.fn(), retry: vi.fn() };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={auth}>
      <SessionContext.Provider value={repository}>{children}</SessionContext.Provider>
    </AuthContext.Provider>
  );
  return { repository, wrapper };
}

beforeEach(() => resetMetricsMigration());
afterEach(() => vi.restoreAllMocks());

describe('useMetricsMigration', () => {
  it('reprocesa los análisis guardados una vez después de iniciar sesión', async () => {
    const { repository, wrapper } = setup({ status: 'signedIn', user: ANA });
    const { rerender, unmount } = renderHook(() => useMetricsMigration(), { wrapper });
    await waitFor(() => expect(repository.migrateMeanRadius).toHaveBeenCalledWith(ANA.uid));
    rerender();
    unmount();
    // Volver a montar (otra pantalla, otra pestaña de la app) no la repite.
    renderHook(() => useMetricsMigration(), { wrapper });
    expect(repository.migrateMeanRadius).toHaveBeenCalledTimes(1);
  });

  it('sin sesión iniciada no hace nada', () => {
    const { repository, wrapper } = setup({ status: 'signedOut' });
    renderHook(() => useMetricsMigration(), { wrapper });
    expect(repository.migrateMeanRadius).not.toHaveBeenCalled();
  });

  it('si falla, se reintenta la próxima vez', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { repository, wrapper } = setup({ status: 'signedIn', user: ANA });
    repository.migrateMeanRadius.mockRejectedValueOnce(new Error('Sin conexión'));
    const first = renderHook(() => useMetricsMigration(), { wrapper });
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    first.unmount();
    renderHook(() => useMetricsMigration(), { wrapper });
    await waitFor(() => expect(repository.migrateMeanRadius).toHaveBeenCalledTimes(2));
  });
});
