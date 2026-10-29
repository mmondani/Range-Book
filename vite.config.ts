import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as {
  version: string;
};

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // El aviso de versión nueva lo muestra la app (`useAppUpdate`), para no recargar en medio
      // de un formulario.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'RangeBook',
        short_name: 'RangeBook',
        description: 'Registro de entrenamientos en el polígono y análisis de blancos.',
        lang: 'es-AR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0B0D0F',
        background_color: '#0B0D0F',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // `/__/` es de Firebase Hosting (el handler del login con redirect): siempre a la red.
        navigateFallbackDenylist: [/^\/__\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://fonts.googleapis.com' ||
              url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Fotos de Storage: cada ruta tiene un contenido fijo, así que se sirven de la caché
            // y se ven sin conexión.
            urlPattern: ({ url }) =>
              url.hostname === 'firebasestorage.googleapis.com' &&
              url.searchParams.get('alt') === 'media',
            handler: 'CacheFirst',
            options: {
              cacheName: 'photos',
              // Las respuestas opacas (`<img>` de otro origen) ocupan mucha cuota: se limitan y,
              // si no hay lugar, se borra la caché antes que fallar.
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 60 * 60 * 24 * 90,
                purgeOnQuotaError: true,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Firebase cambia poco entre despliegues: en su propio chunk, el service worker y el
        // navegador no lo vuelven a bajar cuando solo cambia la app.
        codeSplitting: {
          groups: [{ name: 'firebase', test: /[\\/]node_modules[\\/].*[\\/]@?firebase[\\/]/ }],
        },
      },
    },
    // Los dos chunks rondan los 530–640 kB (170–190 kB con gzip) y el service worker los guarda:
    // no vale la pena dividir más las pantallas.
    chunkSizeWarningLimit: 700,
  },
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'calibration/src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
