# Notas — 001 Fixes

## Desvíos del plan

### Paso 1 — Nombre "Range Book"
- **El nombre quedó en una constante, `APP_NAME` (`src/lib/app-info.ts`).** La usan el manifest (`vite.config.ts` la importa con la extensión `.ts`, como pide el cargador de configuración de Vite), `Logo`, el login y las instrucciones de instalación de Perfil. `index.html` no puede importarla: ahí el nombre sigue escrito a mano (`<title>` y `apple-mobile-web-app-title`).
- **El manifest se verifica con el build, no con un test unitario.** `vite-plugin-pwa` no expone el manifest desde la configuración sin correr Vite. Se comprobó en `dist/manifest.webmanifest` (`name` y `short_name` "Range Book"). Los tests cubren el nombre visible (`logo.test.tsx`, login y perfil).

## Pendientes

## Aprendizajes
- **Un cambio en el manifest no llega a una reinstalación hasta que se acepta la versión nueva.** El service worker precachea `index.html` y `manifest.webmanifest`, y con `registerType: 'prompt'` la versión nueva espera. Al reinstalar la PWA, el navegador lee las copias viejas. Probado en producción: hay que abrir el sitio en el navegador, tocar "Actualizar" y recién después reinstalar.
