# Plan — 002 Upgrades

**Estado:** Terminado
**Requerimientos:** [./requerimientos.md](./requerimientos.md)
**Diseño:** [cambios.md](./diseno/cambios.md) · [maqueta](./diseno/maqueta/index.html)

## Resumen del enfoque
Son dos grupos de cambios. En el **análisis**: la calibración deja de proponer el centro y de avanzar sola entre marcadores; la detección automática se limita a los disparos declarados, quedándose con los candidatos más parecidos a un agujero; y el puntaje pasa a aplicar la regla de "toca la línea" con el diámetro del proyectil según el calibre (revierte una decisión del MVP, va con un ADR). Además, la métrica **"Al centro"** (distancia media de los impactos al centro del blanco) se reemplaza por el **radio medio** (distancia media de los impactos a su PMI). Así cada métrica mide una sola cosa: el PMI, la exactitud; el grupo y el radio medio, la precisión. En la **Evolución** de la sesión: Grupo y Radio medio suman la dispersión de los PMI con un círculo por ronda, y las tres dispersiones permiten tocar un PMI para resaltarlo y abrir el análisis de esa ronda, y hacer zoom con dos dedos (con botones como alternativa). Casi todo es lógica pura en `src/lib/` más cambios en `MpiScatter`, `SessionEvolution` y la pantalla de análisis. El único cambio en el modelo de datos es el snapshot de métricas: `meanDistanceMm` se borra, se agrega `meanRadiusMm` y una migración reprocesa todos los análisis guardados.

## Decisiones tomadas con el usuario
- **"Cae sobre un anillo"** = el agujero toca la línea: un impacto vale el puntaje de la zona más chica cuyo círculo queda a menos de un radio de proyectil de su centro (`distancia − Ø/2 ≤ radio de la zona`). El diámetro sale del calibre del arma (`holeDiameterMm`, 9 mm si no se reconoce).
- **Radio medio en lugar de "Al centro":** se mide desde el PMI (`promedio de |impacto − PMI|`). "Al centro" se borra de la UI, del código y de los datos guardados. No se conserva como métrica aparte.
- **Reprocesar todos los análisis guardados:** a cada análisis guardado se le calcula `meanRadiusMm` con sus impactos en mm (no hacen falta la calibración ni el blanco) y se le borra `meanDistanceMm`. El resto del snapshot (puntaje, grupo, PMI) no se toca.
- **La migración corre en la app**, una vez por usuario después de iniciar sesión, con las reglas actuales. Si falla, se reintenta en el próximo inicio. Se descartó un script con `firebase-admin` para no sumar una dependencia ni una cuenta de servicio.
- **Círculos de la Evolución:** los dos centrados en el PMI de la ronda. Grupo: diámetro = tamaño de grupo. Radio medio: radio = radio medio.
- **"Detalle de la ronda"** = el análisis de la ronda (lo mismo que tocar su tarjeta en Rondas).
- **Sin avance automático en ningún marcador** (Centro, Anillo, Punto A, Punto B).

## Impacto en la arquitectura
- **Nuevo:** ADR 0007 (regla de "toca la línea"). ADR 0008 (radio medio en lugar de "Al centro" y reproceso de los análisis guardados, una excepción explícita al ADR 0003). Función de ranking de candidatos en la detección. Selección de puntos y zoom en `MpiScatter` (`src/lib/scatter-zoom.ts` para la matemática y el hook `usePinchZoom` para los gestos). Migración de los análisis guardados (`src/lib/metrics-migration.ts` + su ejecución desde `src/data/`).
- **Modificado:** `target-zones.ts` (`zoneScore` con diámetro del agujero), `metrics.ts` (`meanRadius` reemplaza a `meanDistance`; `meanRadiusMm` en el snapshot) y `analysis.ts` (pasan el diámetro; `parseMetrics` lee `meanRadiusMm` y, si falta, lo calcula con los impactos), `impact-detection.ts` (tope por disparos con los mejores candidatos), `session-evolution.ts` (radios de los círculos), `chart.ts` (`scatterRings` considera los círculos), `analysis-screen.tsx`, `calibration-panel.tsx`, `mpi-scatter.tsx`, `session-evolution.tsx`, `session-detail.tsx`.
- **Eliminado:** `src/lib/target-center.ts` y su test (el centro automático deja de usarse).
- **Modelo de datos:** en `users/{uid}/sessions/{id}`, el `rounds[].analysis.metrics` de cada ronda cambia `meanDistanceMm` por `meanRadiusMm`. Las reglas no validan las métricas, así que no cambian.
- **Sin cambios pero relevante:** el diámetro del agujero no se guarda. Los análisis guardados conservan su puntaje (snapshot, ADR 0003): el puntaje nuevo se aplica al guardar un análisis nuevo o al reabrir y guardar uno viejo. Rendimiento y los totales de la sesión leen las métricas guardadas y no cambian.

## Archivos
| Archivo | Acción | Motivo |
|---|---|---|
| `src/lib/target-center.ts`, `src/lib/target-center.test.ts` | eliminar | Sin centro automático |
| `src/lib/calibration.ts` (+ test) | modificar | Quitar `nextMarker` si queda sin uso |
| `src/components/calibration-panel.tsx` | modificar | Sin aviso del centro automático; instrucciones "Cuando esté en su lugar, elegí «…»" |
| `src/screens/analysis-screen.tsx` | modificar | Sin `locateCenter` ni avance automático; diámetro del agujero en el puntaje; tope de detección = disparos |
| `src/screens/analysis-screen.test.tsx` | modificar | Criterios de calibración, detección y puntaje |
| `src/lib/target-zones.ts` (+ test) | modificar | `zoneScore(zones, point, holeDiameterMm = 0)` |
| `src/lib/metrics.ts` (+ test) | modificar | `scoreDistribution` y `analysisMetrics` reciben el diámetro; `meanRadius` / `meanRadiusMm` reemplazan a `meanDistance` / `meanDistanceMm` |
| `src/lib/analysis.ts` (+ test) | modificar | `analysisResult` pasa el diámetro; `parseMetrics` lee `meanRadiusMm` (o lo calcula si falta) e ignora `meanDistanceMm` |
| `src/lib/metrics-migration.ts` (+ test) | crear | Funciones puras: si una ronda necesita migrar y cómo queda su `analysis.metrics` (con `meanRadiusMm`, sin `meanDistanceMm`) |
| `src/data/session-repository.ts` (+ test) | modificar | `migrateMeanRadius(uid)`: recorre las sesiones y reescribe las que tienen rondas por migrar |
| `src/hooks/` (hook de la sesión iniciada) | modificar | Corre la migración una vez después de iniciar sesión |
| `src/test/fake-sessions.ts` | modificar | `meanRadiusMm` en lugar de `meanDistanceMm` |
| `src/lib/impact-detection.ts` (+ test) | modificar | Puntaje de parecido a un agujero; `maxImpacts` se queda con los mejores |
| `src/lib/session-evolution.ts` (+ test) | modificar | Métrica `'radius'` ("Radio medio") en lugar de `'center'`; `scatterCircles(evolution, metric)`: radio por ronda (medio grupo o radio medio) |
| `src/screens/analysis-screen.tsx` (tarjeta de métricas) | modificar | `MetricTile` "Radio medio", "Prom. al PMI" en lugar de "Al centro" |
| `src/lib/chart.ts` (+ test) | modificar | Extensión de la dispersión con PMI + radio |
| `src/components/mpi-scatter.tsx` (+ css, test nuevo) | modificar / crear test | Círculos opcionales, puntos como botones, resaltado y opacado |
| `src/components/scatter-selection.tsx` (+ css) | crear | Franja con la ronda tocada y "Ver análisis" |
| `src/lib/scatter-zoom.ts` (+ test) | crear | Vista de la dispersión (escala y desplazamiento): zoom alrededor de un punto, pellizco, límites de 1× a 8× y del desplazamiento, círculos de referencia para la escala visible |
| `src/hooks/use-pinch-zoom.ts` (+ test) | crear | Pointer Events (dos punteros = pellizco; uno con zoom = arrastre), Ctrl + rueda, `touch-action` según el zoom y supresión del toque después de un gesto |
| `src/components/scatter-zoom-controls.tsx` (+ css) | crear | Botones − / + / 1× y el nivel de zoom |
| `src/components/session-evolution.tsx` (+ test) | modificar | Dispersiones en Grupo y Radio medio, una selección compartida por id de ronda entre pestañas, línea y dispersión, prop `analysisPath`; EmptyState con "radio medio" |
| `src/components/line-chart.tsx` (+ css, test) | modificar | Selección opcional (`selectedIndex` / `onSelect`): puntos como botones, banda translúcida de la ronda seleccionada, llevarla a la vista |
| `src/screens/session-detail.tsx` | modificar | Pasa `analysisPath` a `SessionEvolution` |
| `docs/decisiones/0007-toca-la-linea.md` | crear | La decisión del MVP se revierte |
| `docs/decisiones/0008-radio-medio.md` | crear | Radio medio en lugar de "Al centro"; reproceso de los análisis guardados como excepción al ADR 0003 |

## Dependencias nuevas
- Ninguna

## Pasos
- [x] **1. Calibración sin centro automático ni avance automático**
  - Qué: quitar `locateCenter`, `autoDraft`, `locating` y el overlay "Buscando el centro…"; `active` arranca en `'center'`; `placeMarker` deja de llamar a `nextMarker`. Quitar el aviso en `CalibrationPanel` y ajustar las instrucciones. Eliminar `target-center.ts` y su test; quitar `nextMarker` si no queda uso.
  - Verificación: tests de `analysis-screen` (centro sin ubicar al cargar, Centro activo, tocar la foto no cambia el marcador activo, con anillos y sin zonas). `pnpm test` y `pnpm lint`.
- [x] **2. Puntaje con "toca la línea"**
  - Qué: `zoneScore` con el diámetro del agujero; propagarlo a `scoreDistribution`, `analysisMetrics`, `analysisResult`, la tabla de impactos y las etiquetas accesibles de la pantalla (`holeDiameterMm(caliber)`).
  - Verificación: tests de `target-zones` (centro afuera del anillo pero el borde del agujero lo toca → zona de adentro; justo tangente; sin diámetro, como antes), `metrics` y `analysis`; test de la pantalla con un impacto sobre la línea.
- [x] **3. Detección limitada a los disparos declarados**
  - Qué: `detectImpacts` calcula para cada candidato cuánto se parece a un agujero (área contra la esperada, relleno de la caja y proporción) y, si hay más que `maxImpacts`, se queda con los mejores; el resultado sigue ordenado por posición. La pantalla pasa `maxImpacts: round.shots`. Agregar a mano por encima de esa cantidad sigue permitido.
  - Verificación: test con un blanco sintético con más agujeros que disparos más una mancha parecida (se queda con los agujeros reales); test de la pantalla (no propone más que los disparos).
- [x] **4. Radio medio en lugar de "Al centro"**
  - Qué: en `metrics.ts`, `meanRadius(points)` (promedio de la distancia de cada impacto al PMI) reemplaza a `meanDistance`, y `meanRadiusMm` reemplaza a `meanDistanceMm` en `AnalysisMetrics`. `parseMetrics` lee `meanRadiusMm` y, si falta (análisis sin migrar), lo calcula con los impactos guardados. Así la UI nunca muestra la métrica vieja ni un hueco. En el análisis, la tarjeta pasa a "Radio medio" con "Prom. al PMI" (mobile y desktop). En la Evolución, la opción `'center'` / "Al centro" pasa a `'radius'` / "Radio medio", con la línea "Radio medio (mm)" y el EmptyState "…el PMI, el grupo y el radio medio". Se borran todas las referencias a "Al centro" y a `meanDistance` en el código y los tests.
  - Verificación: tests de `metrics` (grupo centrado y corrido dan el mismo radio medio; un impacto da 0; vacío da `null`), de `analysis` (lee `meanRadiusMm`; sin él lo calcula; ignora `meanDistanceMm`), de `session-evolution` (mm, pulgadas y MOA) y de la pantalla de análisis (la tarjeta dice "Radio medio" y guarda `meanRadiusMm` sin `meanDistanceMm`). `grep -ri "al centro\|meanDistance" src` sin resultados fuera de la migración.
- [x] **5. Reprocesar todos los análisis guardados**
  - Qué: `metrics-migration.ts` (puro) decide si una ronda necesita migrar (tiene `analysis` y le falta `meanRadiusMm` o le sobra `meanDistanceMm`) y devuelve sus `metrics` con `meanRadiusMm` calculado desde `analysis.impacts` y sin `meanDistanceMm`; el resto del snapshot queda igual. `session-repository.ts` suma `migrateMeanRadius(uid)`: lee todas las sesiones del usuario y, en cada una con rondas por migrar, reescribe `rounds` en una transacción (las rondas van embebidas, ADR 0002). Es idempotente: una sesión ya migrada no se escribe. Corre una vez después de iniciar sesión, en segundo plano; si falla (sin conexión), se reintenta en el próximo inicio y mientras tanto `parseMetrics` cubre el hueco.
  - Verificación: tests de `metrics-migration` (calcula el radio, borra `meanDistanceMm`, no toca puntaje/grupo/PMI, ronda sin análisis o ya migrada → sin cambios) y del repositorio contra el emulador (`pnpm test:rules` o equivalente): migra, una segunda corrida no escribe. Prueba manual con los datos reales: después de la migración, ningún análisis tiene `meanDistanceMm` (revisión en la consola de Firestore).
- [x] **6. Dispersiones con círculos en Grupo y Radio medio**
  - Qué: `scatterCircles` en `session-evolution.ts`; `MpiScatter` acepta `radius` por punto y escala para que entren los círculos; `SessionEvolution` muestra la dispersión debajo de la línea en Grupo y en Radio medio, con título y leyenda de `cambios.md`.
  - Verificación: tests de `session-evolution` (radios en mm y MOA, ronda sin grupo sin círculo) y de `SessionEvolution` (se ven las dispersiones con sus títulos).
- [x] **7. Seleccionar una ronda: resaltar, "Ver análisis" y selección compartida**
  - Qué: los puntos de `MpiScatter` pasan a ser botones (`aria-pressed`, área ≥ 44 px) con `selectedKey` y `onSelect`; el resto se opaca. `ScatterSelection` muestra la ronda, sus valores y el link al análisis. La selección se quita al tocar de nuevo la ronda seleccionada, un lugar vacío o Escape.
  - **Selección compartida:** `SessionEvolution` guarda una sola ronda seleccionada (`selectedRoundId`, por id de ronda, no por índice) para toda la tarjeta. Cambiar de métrica o de unidad la mantiene; solo el zoom vuelve a 1×. Si la ronda deja de estar en la evolución, por ejemplo porque se borró su análisis, la selección se descarta.
  - **Línea:** `LineChart` suma `selectedIndex` y `onSelect` opcionales. Con ellos, cada punto es un botón ("Ronda 3", `aria-pressed`) que selecciona o quita la ronda, y la ronda seleccionada lleva una banda vertical translúcida `--info` detrás (hasta el eje x; 44 px o el ancho de la franja de la ronda), con su valor y su "R3" destacados. El hover sigue destacando sin seleccionar y no mueve la banda y, si la ronda queda fuera del desplazamiento horizontal, se lleva a la vista. Rendimiento no pasa esas props y queda igual.
  - Verificación: tests de `MpiScatter` y `SessionEvolution` (seleccionar, deseleccionar, link a `/sesiones/:id/rondas/:roundId/analisis`, teclado), con la selección compartida: elegir la ronda 3 en PMI y pasar a Grupo y a Radio medio la mantiene, también al cambiar de unidad; tocar una ronda en la línea la selecciona en la dispersión y tocarla de nuevo la quita. Tests de `LineChart`: sin `onSelect` funciona como hoy, y con `onSelect` tiene botones, `aria-pressed`, la banda en la ronda seleccionada (y ninguna sin selección), que no se mueve con el hover, y Enter / Espacio / Escape. Prueba manual en mobile y desktop.
- [x] **8. Zoom en las dispersiones de la Evolución**
  - Qué: `scatter-zoom.ts` (puro) con la vista `{ scale, tx, ty }`: `zoomAt(view, scale, point)` mantiene fijo el punto, `pinch(start, distancia, punto medio)` resuelve el pellizco, `clampView` limita la escala (1× a 8×) y el desplazamiento al recuadro, y `referenceRings(extent, scale)` elige los dos círculos de referencia para la escala visible. `usePinchZoom` maneja los gestos sobre el SVG: dos punteros pellizcan, uno arrastra si hay zoom, Ctrl + rueda hace zoom en el cursor, y `touch-action` es `pan-x pan-y` a 1× y `none` con zoom. Si hubo gesto, el toque siguiente no cambia la selección. `MpiScatter` proyecta los puntos con la vista, sin escalar puntos, trazos ni textos, y recorta con un `clipPath`. `ScatterZoomControls` muestra − / nivel / + / 1×. `SessionEvolution` vuelve la vista a 1× al cambiar de métrica o de unidad. Sin dependencias nuevas.
  - Verificación: tests de `scatter-zoom` (el punto bajo los dedos queda fijo, límites de escala y de desplazamiento, círculos de referencia por escala), de `usePinchZoom` (pellizco y arrastre simulados con Pointer Events, Ctrl + rueda, la rueda sola no hace zoom, un gesto no selecciona) y de `MpiScatter` / `SessionEvolution` (botones habilitados según el nivel, nivel anunciado, vuelve a 1× al cambiar de métrica o de unidad, la selección se mantiene con zoom). Prueba manual en un teléfono (pellizco, arrastre, la página sigue desplazándose a 1×) y en desktop con trackpad.
- [x] **9. Cierre de la iteración**
  - Qué: verificar criterios, `docs/arquitectura.md`, `docs/diseno/` (según `cambios.md`; también la tarjeta "Al centro" de la maqueta del análisis, M06 / W04), ADR 0007, ADR 0008 y `notas.md`. Antes de cerrar, confirmar que la migración ya corrió sobre los datos reales.
  - Verificación: checklist de "Al terminar".

## Cobertura de criterios de aceptación
| Criterio | Paso(s) | Cómo se verifica |
|---|---|---|
| No proponer un centro: el usuario siempre lo ubica | 1 | test `analysis-screen` |
| Al ubicar el centro no pasa a Anillo; se pasa con el botón | 1 | test `analysis-screen` |
| No detectar más impactos que los disparos de la ronda | 3 | tests `impact-detection` y `analysis-screen` |
| Un tiro sobre un anillo cuenta el valor superior | 2 | tests `target-zones`, `metrics`, `analysis-screen` |
| Grupo y Radio medio: gráfico con el PMI de cada ronda y su círculo | 6 | tests `session-evolution` (lib y componente) |
| Tocar un PMI lo resalta (y su círculo) y opaca los demás | 7 | test `mpi-scatter` + prueba manual |
| Desde el PMI tocado, ir al detalle de la ronda | 7 | test `session-evolution` |
| La ronda seleccionada en una pestaña sigue seleccionada en las otras | 7 | test `session-evolution` |
| Tocar una ronda en la línea la selecciona en el gráfico de PMI | 7 | tests `line-chart` y `session-evolution` |
| Zoom con dos dedos en las dispersiones de PMI, Grupo y Radio medio | 8 | tests `scatter-zoom`, `usePinchZoom`, `MpiScatter`; prueba manual en teléfono |
| El radio medio (desde el PMI) reemplaza a "Al centro" en el análisis y la Evolución | 4 | tests `metrics`, `analysis`, `session-evolution`, `analysis-screen`; grep sin "Al centro" |
| Todos los análisis guardados quedan reprocesados (con `meanRadiusMm`, sin `meanDistanceMm`) | 5 | tests `metrics-migration` y del repositorio; revisión manual en Firestore |

## Riesgos y alternativas descartadas
- **Riesgo:** con fotos reales, el ranking puede descartar un agujero real y quedarse con una mancha. → **Mitigación:** sigue siendo una propuesta; el usuario agrega y quita a mano, y el aviso de no coincidencia sigue.
- **Riesgo:** el calibre del arma no se reconoce y el agujero se toma de 9 mm. → **Mitigación:** es el mismo criterio que ya usa la detección; se documenta en el ADR.
- **Riesgo:** el puntaje de análisis viejos no coincide con el que daría la regla nueva. → **Mitigación:** es el comportamiento del snapshot (ADR 0003); se recalcula al reabrir y guardar.
- **Riesgo:** en Radio medio, los círculos se superponen cuando los PMI quedan cerca. → **Mitigación:** opacidad media y la selección, que resalta uno y opaca el resto.
- **Riesgo:** la migración reescribe `rounds` de una sesión mientras se edita en otro dispositivo. → **Mitigación:** transacción por sesión (relee y aplica sobre lo último); solo cambia `meanRadiusMm` / `meanDistanceMm`.
- **Riesgo:** la migración modifica el historial, en contra del ADR 0003. → **Mitigación:** solo recalcula una métrica que cambió de definición a partir de los impactos guardados (no del inventario); queda como excepción explícita en el ADR 0008.
- **Alternativa descartada:** conservar "Al centro" junto al radio medio. → **Por qué:** decisión del usuario; mezcla exactitud y precisión, y el PMI ya mide la exactitud.
- **Alternativa descartada:** script único con `firebase-admin` que migre a todos los usuarios. → **Por qué:** suma una dependencia de desarrollo y una cuenta de servicio; la migración en la app alcanza.
- **Alternativa descartada:** calcular el radio medio solo al leer, sin migrar. → **Por qué:** el requerimiento pide reprocesar y borrar `meanDistanceMm` de los datos guardados. El cálculo al leer queda solo como respaldo mientras la migración no corrió.
- **Alternativa descartada:** guardar el diámetro del agujero en el análisis. → **Por qué:** no hace falta para leer el snapshot y obligaría a migrar los viejos; se puede agregar si se quiere recalcular sin el arma.
- **Alternativa descartada:** recalcular el puntaje de los análisis guardados al leerlos. → **Por qué:** rompe el ADR 0003 (el historial no cambia solo).
- **Riesgo:** el pellizco choca con el zoom del navegador o con el desplazamiento de la página. → **Mitigación:** `touch-action: pan-x pan-y` a 1× (la página se desplaza con un dedo y el pellizco llega al gráfico) y `none` solo con zoom. Se prueba en un teléfono real.
- **Riesgo:** en la línea, el toque que antes solo destacaba un punto ahora también selecciona, y en mobile eso puede sorprender. → **Mitigación:** tocar de nuevo la quita, y el cambio es solo en la Evolución (Rendimiento sigue igual).
- **Alternativa descartada:** guardar la selección en la URL, como la pestaña (`?vista=`). → **Por qué:** es un estado efímero de lectura; volver del análisis con la ronda resaltada se puede agregar después si hace falta.
- **Alternativa descartada:** una librería de zoom (`d3-zoom`, `react-zoom-pan-pinch`). → **Por qué:** suma una dependencia para un solo gráfico; con Pointer Events alcanza.
- **Alternativa descartada:** escalar el SVG entero con `transform`. → **Por qué:** agrandaría los puntos, los números y los trazos; el objetivo es separar los PMI que se superponen.
- **Alternativa descartada:** dejar `target-center.ts` sin uso. → **Por qué:** es código muerto con tests; queda en el historial de git si se quiere volver.

## Preguntas abiertas
- Ninguna (resueltas arriba, en "Decisiones tomadas con el usuario").

## Al terminar
- [x] Todos los criterios de aceptación verificados
- [x] Tests y lint pasan
- [x] `docs/arquitectura.md` actualizado
- [x] `docs/diseno/` actualizado si la iteración cambió la UI
- [x] ADR creado si corresponde
- [x] `notas.md` completado
