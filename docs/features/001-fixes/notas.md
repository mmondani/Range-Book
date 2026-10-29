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
- **Prueba visual pendiente:** no hubo navegador en la sesión; los tamaños (52 px por punto, valores en 12 px) hay que verlos en el celular. *(Verificado por el usuario en producción: está bien.)*

### Paso 4 — Evolución dentro de la sesión
- **`sessionEvolution(rounds, measure)` sin `units`.** Devuelve mm o MOA, como `performance.ts`; la conversión a la unidad del perfil la hace la tarjeta al mostrar. `analyzedRounds` y `EVOLUTION_METRICS` también quedaron en `session-evolution.ts`.
- **`scatterRings` en `chart.ts`:** los dos círculos de referencia de la dispersión (un radio redondo y su doble).
- **Desktop:** el encabezado del panel Rondas no suma el texto "N rondas · N analizadas" de la maqueta: la cantidad ya va en la pestaña. "Agregar ronda" se ve solo con la pestaña Rondas.
- **La unidad dice "in", no "pulg":** se usa el mismo símbolo que en el resto de la app (`UNIT_SYMBOLS`).
- **La lista de rondas dejó de tener título.** El `<h2>`/`<h3>` "Rondas · N" lo reemplaza la pestaña "Rondas N"; los tests que buscaban el título ahora buscan la pestaña.
- **Al abrir "Agregar ronda" desde la pestaña Evolución,** detrás del sheet se ve la pestaña Rondas (el link no lleva `?vista=`). Al cerrar el sheet se vuelve atrás en el historial y la Evolución vuelve a estar.

### Paso 5 — Visor de fotos
- **Componente extra, `PhotoButton`:** la foto como botón ("Ver la foto N de M en pantalla completa", cursor `zoom-in`) que abre el visor. La foto conserva su texto alternativo, así el aviso "no se pudo cargar" sigue diciendo cuál es.
- **El visor usa su propio `<img>` (con `usePhotoSrc`), como `TargetAnalyzer`,** porque necesita el tamaño natural de la foto para el zoom; `Photo` no cambió.
- **Anterior / siguiente también en mobile.** La maqueta mobile solo tenía deslizar, pero el sistema de diseño pide un control visible para todo gesto.
- **Hasta 10×, no 8×:** se reutiliza `MAX_ZOOM` de `zoom.ts`.
- **Sin animación al deslizar:** la foto cambia al soltar el dedo (la maqueta usaba `scroll-snap`). Con zoom, deslizar desplaza la foto en vez de cambiarla.
- **Foco:** en la primera o la última foto su flecha se deshabilita; si tenía el foco, el foco vuelve al visor (si no, se escapaba del diálogo y dejaban de andar las flechas del teclado y Escape). Lo encontraron los tests.
- **El visor queda arriba de los sheets** (se abre también desde el selector de fotos de un formulario) y debajo de los toasts.
- **Pellizco y doble toque no tienen test automático** (jsdom no los simula bien); hay que probarlos en el celular.

### Paso 6 — Homografía
- **`tiltDraft(start, from, to, size)`** recibe además el tamaño de la foto: el arrastre se mide en lados mayores (0,02 rad por cada 1 %), así se siente igual con cualquier resolución. Por debajo de medio grado no guarda inclinación.
- **Funciones extra en `calibration.ts`:** `untiltedDraft` ("Quitar la inclinación") y `describeTilt` («Inclinación: 30° hacia abajo»), para que el texto no quede en el componente.
- **Sin inclinación, el camino es el de antes.** `pixelEllipse` usa la cónica proyectada solo con `tilt`; con la forma vieja o sin forma sigue con la fórmula afín. Así los 300 tests anteriores pasaron sin cambios.
- **`mmPerPixel` es la escala local en el centro del blanco** (la raíz del determinante de la derivada de la homografía). Con perspectiva, un agujero lejos del centro mide un poco distinto en píxeles; la detección usa este valor promedio.
- `reshapeDraft` sigue hasta el paso 7, que la reemplaza en la pantalla.

### Paso 7 — Inclinación en la pantalla de calibración
- **Se eliminó `reshapeDraft`** (y sus tests). Los tests de la forma vieja quedaron como "calibraciones guardadas antes de la inclinación": se siguen midiendo igual, se guardan y se leen.
- **El arrastre cuenta desde el primer movimiento del dedo**, no desde donde se apoyó (el analizador avisa los movimientos, no el apoyo). Un toque sin arrastrar no cambia nada.
- **Calibración vieja con forma:** "Inclinación" aparece con ✓, el panel avisa "Esta foto se calibró con la forma anterior de los anillos. Si la inclinás, se reemplaza por la inclinación." y "Quitar la inclinación" también quita la forma. Al empezar a inclinar, los anillos arrancan de círculos (no se convierte la forma vieja en inclinación).
- **Blancos sin zonas:** no tienen inclinación; su panel sigue diciendo "La foto tiene que estar sacada de frente."
- **Prueba con fotos reales pendiente** (riesgo del plan): ver si la distancia focal supuesta (0,75 × el lado mayor) y la sensibilidad del arrastre (0,02 rad por 1 %) se sienten bien.

### Paso 8 — Cierre
- `docs/diseno/` actualizado: la maqueta general toma las pantallas de esta iteración (y el visor, M13 / W08), `pantallas.md` y `design-system.md` describen lo implementado. El nombre pasó a "Range Book" también en la documentación de diseño.
- ADR 0006 (inclinación con perspectiva); el ADR 0004 apunta a él para la compensación de fotos en ángulo.

## Desvíos respecto de la maqueta aprobada
Ya llevados a `docs/diseno/maqueta/` (la maqueta de la iteración queda como se aprobó):
- **PMI:** "(−4,1; −13,2)" en 13 px, igual en mobile y desktop, en lugar de "X −4,1 · Y −13,2" (y con la unidad en desktop). Pedido por el usuario al probarlo.
- **Visor mobile:** suma las flechas anterior / siguiente. Al deslizar no hay animación: la foto cambia al soltar. Zoom hasta 10× (no 8×).
- **Detalle de sesión en desktop:** sin el texto "N rondas · N analizadas" junto a "Agregar ronda" (la cantidad va en la pestaña).
- **Unidad de la Evolución en pulgadas:** "in", no "pulg".

## Pendientes
Verificados por el usuario en producción (2026-10-29): funcionan bien, no hace falta ajustar nada. Se dejan anotados como límites conocidos del enfoque.
- **Inclinación con fotos reales sacadas en ángulo** (y con zoom): los anillos coinciden y la sensibilidad del arrastre se siente bien. Si en el futuro hiciera falta, se ajustan `FOCAL_LENGTH` o `TILT_PER_SIDE` en `calibration.ts`.
- **Centro automático con perspectiva:** `target-center.ts` busca el centro de los anillos en la foto, que con el blanco inclinado no coincide exactamente con su centro real. Se corrige a mano; si molesta, buscar el centro después de inclinar.
- **Detección con perspectiva fuerte:** usa un solo tamaño de agujero (el del centro del blanco); los agujeros lejanos miden un poco distinto.
- **"Agregar ronda" desde la pestaña Evolución:** detrás del sheet se ve la pestaña Rondas (el link no lleva `?vista=`). Al cerrar vuelve a Evolución.
- **Pellizco y doble toque del visor** no tienen tests automáticos.

## Aprendizajes
- **Los scripts con comillas invertidas no van en `node -e "…"` dentro de bash:** el shell las interpreta como comandos y el texto queda roto (pasó tres veces, una llegó a un commit). Para ediciones con texto Markdown o template strings, usar Edit o un heredoc con el delimitador entre comillas (`<<'EOF'`).
- **Los tests de foco encontraron un bug real del visor:** un botón deshabilitado que tenía el foco lo saca del diálogo. Vale la pena probar el teclado en los extremos (primera y última foto).
- **Un cambio en el manifest no llega a una reinstalación hasta que se acepta la versión nueva.** El service worker precachea `index.html` y `manifest.webmanifest`, y con `registerType: 'prompt'` la versión nueva espera. Al reinstalar la PWA, el navegador lee las copias viejas. Probado en producción: hay que abrir el sitio en el navegador, tocar "Actualizar" y recién después reinstalar.
