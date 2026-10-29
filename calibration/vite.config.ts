import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Herramienta de desarrollo para marcar el set de fotos y evaluar la detección (`pnpm
 * calibration`). Es otra app de Vite: usa `src/` de la app pero no entra en su build.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../src', import.meta.url)),
    },
  },
  server: { port: 5174 },
});
