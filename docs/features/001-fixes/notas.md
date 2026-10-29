# Notas — 001 Fixes

## Desvíos del plan

### Paso 1 — Nombre "Range Book"
- **El nombre quedó en una constante, `APP_NAME` (`src/lib/app-info.ts`).** La usan el manifest (`vite.config.ts` la importa con la extensión `.ts`, como pide el cargador de configuración de Vite), `Logo`, el login y las instrucciones de instalación de Perfil. `index.html` no puede importarla: ahí el nombre sigue escrito a mano (`<title>` y `apple-mobile-web-app-title`).
- **El manifest se verifica con el build, no con un test unitario.** `vite-plugin-pwa` no expone el manifest desde la configuración sin correr Vite. Se comprobó en `dist/manifest.webmanifest` (`name` y `short_name` "Range Book"). Los tests cubren el nombre visible (`logo.test.tsx`, login y perfil).

### Paso 2 — Coordenadas del PMI
- **`formatSignedLength` quedó en `units.ts`, no en `format.ts` (`formatSigned`).** Formatea una medida en mm en la unidad del perfil, con sus decimales (1 en mm, 2 en pulgadas), igual que `formatLengthValue`, que ya está ahí.
- **Formato de las coordenadas, cambiado después de probarlo (pedido del usuario):** de "X −4,1 · Y −13,2" (y con la unidad en desktop) a "(−4,1; −13,2)" en los dos tamaños, para que ocupe menos, en 13 px (el tamaño de las etiquetas; el sistema de diseño no usa menos de 14 px en textos secundarios salvo esas). Difiere de la maqueta aprobada; `cambios.md` ya lo refleja.

### Paso 3 — Valores en los gráficos de Rendimiento
- **Sin `ChartFrame`.** Como `LineChart` quedó como único gráfico, el eje y fijo y el desplazamiento van dentro de él. `ChartAxes` y `ChartValueLabel` se reemplazaron por `ChartYAxis` (el eje y, en un SVG aparte) y por las etiquetas dibujadas en `LineChart`. Se eliminaron `BarChart` y la opción `zero` de `niceTicks`.
- **`ChartPoint` tiene `axisLabel`, sin `detail`.** La etiqueta del eje x (`2 ago`, `R1`) alcanza también para el tooltip y el resumen accesible; `chartSummary` recibe qué es cada punto (`sesiones`, `rondas`).
- **Gráficos en px reales.** Antes se escalaban con `viewBox` a un ancho fijo; ahora miden su contenedor (`useElementWidth`, con `ResizeObserver`) y solo se fija la altura (180 px en mobile, 240 en desktop).
- **Excepción de lint en `LineChart`:** `jsx-a11y/no-noninteractive-tabindex` desactivada en el contenedor que se desplaza, que tiene que poder enfocarse con el teclado (WCAG 2.1.1). Solo tiene `tabIndex` cuando los puntos no entran.
- **Prueba visual pendiente:** no hubo navegador en la sesión; los tamaños (52 px por punto, valores en 12 px) hay que verlos en el celular.

## Pendientes

## Aprendizajes
- **Un cambio en el manifest no llega a una reinstalación hasta que se acepta la versión nueva.** El service worker precachea `index.html` y `manifest.webmanifest`, y con `registerType: 'prompt'` la versión nueva espera. Al reinstalar la PWA, el navegador lee las copias viejas. Probado en producción: hay que abrir el sitio en el navegador, tocar "Actualizar" y recién después reinstalar.
