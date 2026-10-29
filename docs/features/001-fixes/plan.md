# Plan — 001 Fixes

**Estado:** En curso
**Requerimientos:** [./requerimientos.md](./requerimientos.md)
**Diseño:** [cambios.md](./diseno/cambios.md) · [maqueta](./diseno/maqueta/index.html)

## Resumen del enfoque
Seis cambios independientes, cada uno en su paso, ordenados de menor a mayor riesgo. Los tres chicos (nombre de la PWA, coordenadas del PMI, valores en los gráficos) reutilizan lo que ya existe. Todos los gráficos por sesión o por ronda pasan a ser de línea (el tamaño de grupo de Rendimiento deja las barras), así que `BarChart` se elimina. La evolución dentro de la sesión reutiliza `LineChart` (generalizando el eje x para que acepte "R1") y suma una dispersión de PMI propia. El visor de fotos es un componente nuevo que reutiliza las funciones puras de `zoom.ts`. El cambio de fondo es la **inclinación con perspectiva**: la calibración pasa de una elipse afín 2 × 2 a una **homografía** (cámara estenopeica con el blanco girado en 3D), que sigue siendo una función pura en `calibration.ts` y deja intactas sus firmas públicas (`pixelToMm`, `mmToPixel`, `pixelEllipse`, `mmPerPixel`), así el analizador, la detección y las métricas no cambian.

Decisiones tomadas con el usuario antes del plan: perspectiva real (no afín); en Rendimiento, ancho mínimo por punto con desplazamiento horizontal; visor solo en las "fotos de contenido"; en la sesión, el PMI se grafica como desvío (línea) **y** como dispersión sobre el blanco.

## Impacto en la arquitectura
- **Nuevo:**
  - `PhotoViewer` (visor a pantalla completa) y el hook `usePhotoViewer` (abre y cierra con una entrada del historial: "atrás" lo cierra).
  - `SessionEvolution` (tarjeta del detalle de sesión) y `MpiScatter` (dispersión de PMI en SVG).
  - `src/lib/session-evolution.ts`: series por ronda analizada (desvío del PMI, grupo, distancia al centro, PMI x/y), con MOA si la sesión mezcla distancias.
  - `src/lib/homography.ts`: matrices 3 × 3, proyección y elipse de una cónica proyectada.
  - Hook `useElementWidth` (ResizeObserver) para dibujar los gráficos al ancho real.
- **Modificado:**
  - `calibration.ts`: `Calibration` de anillos admite `tilt?: { x, y }` (radianes; la dirección es hacia dónde se inclina). La transformación píxel ↔ mm es una homografía. `reshapeDraft` se reemplaza por `tiltDraft` (arrastre → inclinación). La forma afín vieja (`shape`) se sigue **leyendo** para los análisis ya guardados (ver Riesgos).
  - `chart.ts`, `LineChart`, `ChartAxes`, `ChartValueLabel`, `ChartHitAreas`: valor en cada punto, ancho mínimo por punto, desplazamiento con el eje y fijo, etiqueta del eje x genérica (`axisLabel`) en lugar de la fecha.
  - `MarkerPicker` / `CalibrationPanel` / `analysis-screen.tsx`: "Inclinación", texto de la inclinación, "Quitar la inclinación".
  - `analysis-screen.tsx`: línea X / Y en la tarjeta del PMI.
  - `PhotoGallery`, `PhotoStrip`, `PhotoPicker`, `session-detail.tsx` (grilla desktop): abren el visor.
  - `vite.config.ts` e `index.html`: "Range Book".
- **Eliminado:** `BarChart` (`bar-chart.tsx`) y la opción `zero` de `chartLayout` / `niceTicks`, si no queda otro uso.
- **Modelo de datos:** solo `analysis.calibration` de las rondas: campo opcional `tilt: { x: number, y: number }`. Las reglas no recorren las rondas (ADR 0002), así que **no cambian las reglas**. Las métricas guardadas no cambian (ADR 0003).
- **Sin cambios pero relevante:** `metrics.ts` (ya guarda `mpi` con x / y), `impact-detection.ts` (usa `mmPerPixel` y `pixelEllipse`), `zoom.ts`, `performance.ts`.

## Archivos
| Archivo | Acción | Motivo |
|---|---|---|
| `vite.config.ts`, `index.html` | modificar | `name`, `short_name` y `apple-mobile-web-app-title` = "Range Book" |
| `src/components/logo.tsx`, `src/screens/login-screen.tsx`, `src/screens/profile-screen.tsx` (+ tests) | modificar | Nombre visible "Range Book" |
| `src/lib/format.ts` (+ test) | modificar | `formatSigned` ("+3,2", "−12,8") |
| `src/screens/analysis-screen.tsx` (+ test) | modificar | X / Y del PMI; textos de la inclinación |
| `src/lib/chart.ts` (+ test) | modificar | `MIN_BAND`, ancho del gráfico según la cantidad de puntos, `axisLabel`, qué etiquetas del eje x entran |
| `src/components/line-chart.tsx`, `chart-axes.tsx`, `chart-value-label.tsx`, `chart-hit-areas.tsx`, `chart.module.css` | modificar | Valor en cada punto, eje y fijo, desplazamiento |
| `src/components/bar-chart.tsx` | eliminar | El tamaño de grupo pasa a ser de línea; no queda otro uso |
| `src/components/chart-frame.tsx` (+ test) | crear | Contenedor: eje y fijo + área desplazable que arranca al final |
| `src/hooks/use-element-width.ts` | crear | Ancho real del contenedor |
| `src/screens/performance-screen.tsx` (+ test) | modificar | Usar el ancho real; puntos con `axisLabel` |
| `src/lib/session-evolution.ts` (+ test) | crear | Series por ronda analizada y medida (mm o MOA) |
| `src/components/session-evolution.tsx` (+ css, test) | crear | Tarjeta con `SegmentedControl` y gráficos |
| `src/components/mpi-scatter.tsx` (+ css) | crear | Dispersión de PMI |
| `src/screens/session-detail.tsx` (+ css) | modificar | Pestañas Rondas / Evolución (`?vista=`); fotos abren el visor |
| `src/screens/sessions-screen.test.tsx` | modificar | Tests de las pestañas del detalle |
| `src/components/photo-viewer.tsx` (+ css, test) | crear | Visor a pantalla completa |
| `src/hooks/use-photo-viewer.ts` | crear | Abrir / cerrar con el historial |
| `src/components/photo-gallery.tsx`, `photo-strip.tsx`, `photo-picker.tsx` (+ tests) | modificar | Tocar la foto abre el visor |
| `src/lib/homography.ts` (+ test) | crear | Álgebra 3 × 3 y elipse de una cónica |
| `src/lib/calibration.ts` (+ test) | modificar | Modelo de inclinación con perspectiva |
| `src/components/marker-picker.tsx`, `calibration-panel.tsx` | modificar | "Inclinación", texto y "Quitar la inclinación" |
| `docs/decisiones/0006-inclinacion-con-perspectiva.md` | crear (al cerrar) | Reemplaza la parte "aproximación afín" del ADR 0004 |

## Dependencias nuevas
- Ninguna.

## Pasos
- [x] **1. Nombre "Range Book"**
  - Qué: `name` y `short_name` "Range Book" en el manifest; `apple-mobile-web-app-title` en `index.html`; textos visibles en `logo.tsx` (nombre y texto oculto), `login-screen.tsx` y las instrucciones de instalación de `profile-screen.tsx`.
  - Verificación: test que lee la config del manifest de `vite.config.ts`; tests de `Logo`, login y perfil con el nombre nuevo; `pnpm build` y revisar `dist/manifest.webmanifest`. Manual: reinstalar la PWA (el nombre de una ya instalada se actualiza recién al reinstalar en iOS).
- [x] **2. Coordenadas del PMI**
  - Qué: `formatSigned` en `format.ts` (signo `+` / `−` U+2212, coma decimal, sin signo en 0). En la tarjeta del PMI, la línea "X −4,1 · Y −13,2" (mobile) o "X −4,1 mm · Y −13,2 mm" (desktop), en la unidad del perfil. Con 0 impactos no se muestra.
  - Verificación: tests de `formatSigned`; test de `analysis-screen` con impactos conocidos que comprueba X e Y (y en pulgadas).
- [x] **3. Valores en los gráficos de Rendimiento**
  - Qué: `chart.ts` calcula el ancho (`max(contenedor, puntos × 52 px)`) y qué fechas del eje x entran sin superponerse; los gráficos dibujan en px reales (sin escalar por `viewBox`), con el valor sobre cada punto (sin unidad) y el destacado más grande; el destacado muestra su fecha resaltada en el eje x. En Rendimiento, "Tamaño de grupo" pasa de `BarChart` a `LineChart` (escala ajustada a los valores, como el puntaje; sigue la nota "Menor es mejor") y se elimina `BarChart`. `ChartFrame` separa el eje y (fijo) del área desplazable, que arranca mostrando los más recientes. `ChartPoint` cambia `date` por `axisLabel` + `detail` (para el tooltip y el resumen accesible).
  - Verificación: tests de `chart.ts` (ancho, etiquetas que entran); test de `LineChart` que comprueba un valor por punto; test de `performance-screen` actualizado (los dos gráficos son de línea). Manual en mobile con 20 sesiones.
- [x] **4. Evolución dentro de la sesión**
  - Qué: `sessionEvolution(session, measure, units)` devuelve, por ronda analizada en orden, `R{n}`, desvío del PMI, PMI x / y, grupo y distancia al centro en la medida pedida (`length` en la unidad del perfil, o `moa` con la distancia de cada ronda). `defaultEvolutionMeasure(session)`: `moa` si las rondas analizadas tienen distancias distintas; si no, `length`. `SessionEvolution`: `SegmentedControl` PMI / Grupo / Al centro y otro chico **mm | MOA** ("pulg | MOA" en pulgadas) en el encabezado, con estado local (no se guarda); PMI = `LineChart` del desvío + `MpiScatter`; Grupo = `LineChart`; Al centro = `LineChart` (los tres, de línea). Títulos y referencias dicen la unidad. Estados: sin rondas analizadas, EmptyState "Todavía no hay rondas analizadas"; con una, el texto "Con dos rondas analizadas o más vas a ver la evolución."
  - En `session-detail.tsx`, las rondas y la evolución pasan a ser dos pestañas (`Tabs` + `tabPanelProps`, ya existentes): **Rondas** (con la cantidad; por defecto) y **Evolución**. La pestaña va en la query string (`?vista=evolucion`, con `replace` al cambiar), así se conserva al volver del análisis o recargar. Las notas quedan debajo de las pestañas. En desktop, "Agregar ronda" va en el encabezado del panel Rondas; en mobile, la barra fija no cambia.
  - Verificación: tests de `session-evolution.ts` (orden, ignora no analizadas, mm, pulgadas y MOA por distancia de cada ronda, medida por defecto con y sin distancias mezcladas); test del componente (cambia de gráfico, cambia de unidad, estados, resúmenes accesibles); test del detalle de sesión (Rondas por defecto, cambiar a Evolución actualiza `?vista=`, entrar con `?vista=evolucion` la abre, las notas se ven con las dos).
- [x] **5. Visor de fotos a pantalla completa**
  - Qué: `PhotoViewer` (portal, `role="dialog"`, fondo negro, contador, Cerrar, Acercar / Alejar, anterior / siguiente en desktop, deslizar en mobile, dos dedos, doble toque, Ctrl + rueda, flechas y Escape; hasta 8×; el zoom vuelve a 1 al cambiar de foto). Gestos con las funciones de `zoom.ts` (no se toca el `TargetAnalyzer`). `usePhotoViewer` guarda la foto abierta en el estado del historial (`navigate(..., { state })`), así "atrás" lo cierra. Se abre desde `PhotoGallery` (foto principal), `PhotoStrip`, la grilla de fotos de W02 y las miniaturas de `PhotoPicker` (el ✕ de quitar sigue igual). Cada foto disparadora es un `<button>` con `aria-label` "Ver la foto N en pantalla completa". Funciona con fotos pendientes de subir.
  - Verificación: tests de `PhotoViewer` (abre en la foto tocada, contador, siguiente / anterior, Escape y Cerrar vuelven atrás, foco); tests de `PhotoGallery`, `PhotoStrip` y `PhotoPicker` (tocar abre el visor; quitar no lo abre). Manual en el celular (gestos).
- [x] **6. Homografía (lógica pura)**
  - Qué: `homography.ts` (multiplicar, invertir, transponer, proyectar, elipse de la cónica `Hᵀ⁻¹ Q H⁻¹`). En `calibration.ts`: cámara con punto principal en el centro de la foto y focal `0,75 ×` el lado mayor; el blanco girado `tilt` alrededor de un eje de la foto perpendicular a la dirección de inclinación; el centro del blanco proyecta sobre el marcador del centro y la escala sale del punto del anillo. `pixelToMm`, `mmToPixel`, `pixelEllipse` (ahora la elipse proyectada, con su centro corrido) y `mmPerPixel` (escala local en el centro) usan la homografía. Sin `tilt`, el resultado es idéntico al actual. `tiltDraft(start, from, to)`: inclinación = la del inicio + arrastre × 0,02 rad por % del lado mayor, hasta 70°. Se lee y se guarda `tilt`; la forma afín vieja (`shape`) se sigue leyendo y usando para mostrar análisis guardados.
  - Verificación: tests: sin inclinación coincide con los valores actuales (los tests existentes siguen pasando); ida y vuelta píxel → mm → píxel; el punto del anillo cae sobre la elipse de su anillo; con inclinación hacia abajo el lado de abajo se ve más grande y el centro de la elipse se corre; la elipse coincide con puntos proyectados del círculo; `parseCalibration` con `tilt` válido, inválido y con `shape` viejo. (La matemática ya está probada en la maqueta, `assets/calibration.js`.)
- [ ] **7. Inclinación en la pantalla de calibración**
  - Qué: "Forma" → **Inclinación** (`MarkerPicker`); el arrastre usa `tiltDraft` (tocar sin arrastrar no cambia nada; el punto del anillo queda fijo); `CalibrationPanel` muestra "Inclinación: 30° hacia abajo" y **Quitar la inclinación**; textos según `cambios.md`. Abrir "Inclinación" en un análisis con `shape` viejo arranca sin inclinación (y lo avisa el texto del panel); al guardar, `shape` se reemplaza por `tilt`.
  - Verificación: tests de `analysis-screen` (arrastrar con "Inclinación" cambia los anillos y muestra el texto; Quitar la inclinación; guardar persiste `tilt`). Manual con fotos reales sacadas en ángulo (ver Riesgos).
- [ ] **8. Cierre**
  - Qué: verificar criterios, `pnpm test`, `pnpm lint`, `pnpm build`; actualizar `docs/arquitectura.md`, `docs/diseno/` (según `cambios.md`), ADR 0006 y `notas.md`.
  - Verificación: checklist "Al terminar".

## Cobertura de criterios de aceptación
| Criterio | Paso(s) | Cómo se verifica |
|---|---|---|
| Gráficas de rendimiento muestran el valor de cada punto | 3 | tests de `chart.ts`, `LineChart`, `performance-screen`; manual con muchas sesiones |
| La forma deforma los círculos como un cambio de ángulo de visión | 6, 7 | tests de `calibration.ts`/`homography.ts` y de `analysis-screen`; manual con fotos reales |
| PMI muestra distancia **y** coordenadas X / Y en mm | 2 | tests de `format.ts` y `analysis-screen` |
| La PWA instalada se llama "Range Book" | 1 | test de la config; manifest del build; manual |
| Tocar una imagen cargada la amplía a pantalla completa | 5 | tests de `PhotoViewer` y de los componentes de fotos; manual |
| En la sesión, gráficos de PMI, grupo y distancia al centro por ronda | 4 | tests de `session-evolution.ts` y `SessionEvolution` |

## Riesgos y alternativas descartadas
- **Riesgo:** la focal real depende del celular y del zoom con que se sacó la foto; con zoom la perspectiva real es menor que la del modelo. → **Mitigación:** la inclinación la ajusta el usuario a ojo hasta que los anillos coinciden, así compensa en buena parte; probar con fotos reales en el paso 7 y, si hace falta, ajustar la constante (anotarlo en `notas.md`).
- **Riesgo:** análisis guardados con la forma afín vieja. → **Mitigación:** se siguen leyendo con el modelo afín (los impactos se ven donde estaban y las métricas guardadas no cambian, ADR 0003). Solo al volver a usar "Inclinación" se reemplaza por el modelo nuevo. Alternativa descartada: convertir `shape` en `tilt` al leer, porque movería los impactos sobre la foto.
- **Riesgo:** el centro automático (`target-center.ts`) busca el centro de los anillos en la foto, que con perspectiva no es exactamente el centro de las elipses. → **Mitigación:** con inclinaciones moderadas la diferencia es chica y el usuario puede corregir el centro a mano; anotarlo como pendiente si molesta.
- **Riesgo:** desplazamiento horizontal dentro de una página que también scrollea en vertical. → **Mitigación:** `overscroll-behavior-x: contain` y `touch-action: pan-x pan-y`; probarlo en el celular.
- **Alternativa descartada:** inclinación afín (solo aplastar). → **Por qué:** el usuario eligió perspectiva real.
- **Alternativa descartada:** extraer los gestos del `TargetAnalyzer` a un hook compartido con el visor. → **Por qué:** el analizador tiene gestos propios (arrastre de marcadores, agregar impactos) y tocarlo es riesgoso; el visor reutiliza solo las funciones puras de `zoom.ts`.
- **Alternativa descartada:** librería de visor (p. ej. PhotoSwipe). → **Por qué:** una dependencia nueva para algo que `zoom.ts` ya resuelve.

## Preguntas abiertas
- Ninguna. Resueltas con el usuario:
  1. **Nombre visible:** "Range Book" en toda la app (logo, login, Perfil), no solo en la PWA → paso 1.
  2. **PMI X / Y:** por ahora solo en la pantalla de análisis (Rendimiento no cambia) → paso 2.
  3. **Unidad de la Evolución:** el usuario elige mm o MOA con un control en la tarjeta; por defecto MOA si se mezclan distancias → paso 4.
  4. **Rondas y Evolución en pestañas** dentro del detalle de la sesión, para que no sea un scroll tan largo → paso 4.
  5. **Gráficos de línea:** el tamaño de grupo es de línea en la Evolución y en Rendimiento → pasos 3 y 4.

## Al terminar
- [ ] Todos los criterios de aceptación verificados
- [ ] Tests y lint pasan
- [ ] `docs/arquitectura.md` actualizado
- [ ] `docs/diseno/` actualizado si la iteración cambió la UI
- [ ] ADR creado si corresponde
- [ ] `notas.md` completado
