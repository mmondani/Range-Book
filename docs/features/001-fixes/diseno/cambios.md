# Cambios de diseño — 001 Fixes

**Maqueta:** [`maqueta/index.html`](./maqueta/index.html) (solo las pantallas nuevas o modificadas).

## Pantallas nuevas

### M13 / W08 · Visor de fotos (`mobile/visor-fotos.html`, `web/visor-fotos.html`)
- Al tocar una foto de contenido se abre a pantalla completa, sobre fondo negro (no cambia con el tema; los botones usan el estilo de los botones sobre fotos).
- Arriba: contador "1 / 3" y **Cerrar** (✕). Abajo a la derecha: **Acercar** / **Alejar**.
- Deslizar (mobile) o las flechas **Foto anterior** / **Foto siguiente** y el teclado (desktop) cambian de foto. Al cambiar, el zoom vuelve a 1.
- Zoom: dos dedos acercan y desplazan; con la foto ampliada, un dedo o el mouse la desplazan; doble toque acerca o vuelve; Ctrl + rueda en desktop. Hasta 8×.
- Tiene URL propia en el historial (estado de la navegación): "atrás" y Escape lo cierran.
- `role="dialog"`, `aria-modal`, foco en "Cerrar" al abrir y de vuelta en la foto al cerrar.
- **Dónde se abre:** galería del arma (M09/W07, foto principal), fotos del polígono (M03 `PhotoStrip`, W02 grilla), miniaturas del `PhotoPicker` en los formularios (arma, sesión, ronda, blanco). **No** se abre desde miniaturas que son parte de un link (tarjeta de ronda, tarjeta de blanco, tarjetas de armas) ni desde el analizador (ahí tocar agrega impactos).

## Pantallas modificadas

### M03 / W02 · Detalle de sesión — pestañas "Rondas" y "Evolución"
- Debajo de los totales (y de las fotos en W02), dos pestañas con el componente `Tabs` (chips en mobile, subrayadas en desktop): **Rondas** (con su cantidad) y **Evolución**. Reemplazan al título "Rondas · N". Así el detalle no se hace un scroll tan largo.
- **Rondas** (por defecto): la lista de rondas como hoy. En desktop, "Agregar ronda" sigue en el encabezado del panel, al lado de "N rondas · N analizadas". En mobile, la barra fija "Agregar ronda" se ve con las dos pestañas.
- **Evolución:** la tarjeta descripta abajo.
- La pestaña elegida va en la query string (`?vista=evolucion`; Rondas no aparece), así "atrás", volver desde el análisis o recargar la conservan. Cambiar de pestaña reemplaza la entrada del historial (no la apila).
- Las **Notas** quedan debajo de las pestañas, visibles con cualquiera de las dos.
- La pestaña Evolución está siempre. Sin rondas analizadas, muestra el EmptyState "Todavía no hay rondas analizadas" ("Analizá los blancos de las rondas para ver cómo evolucionan el PMI, el grupo y la distancia al centro").

**Tarjeta Evolución**
- Control segmentado **PMI / Grupo / Al centro**. Una ronda analizada por punto; el eje x dice "R1, R2…" (número de ronda en la sesión).
- **PMI:** línea con el desvío del PMI por ronda **y** dispersión de los PMI de cada ronda alrededor del centro (cruz de ejes, dos círculos de referencia con su medida, puntos numerados por ronda, recorrido punteado tenue y la última resaltada).
- **Grupo:** línea con el tamaño de grupo. **Al centro:** línea con la distancia media al centro. Los tres gráficos de la evolución son de línea.
- **Unidad elegible:** un control segmentado chico en el encabezado de la tarjeta, **mm | MOA** ("pulg | MOA" si el perfil usa pulgadas). Se aplica a los tres gráficos y a la dispersión (títulos y círculos de referencia dicen la unidad). MOA se calcula con la distancia de cada ronda. Por defecto: la unidad del perfil si todas las rondas analizadas son a la misma distancia; **MOA** si se mezclan distancias. La elección vale mientras se mira la sesión (no se guarda).
- La nota de la tarjeta: "Por ronda analizada · N de M".
- **Estados:** una sola ronda analizada → la tarjeta muestra solo "Con dos rondas analizadas o más vas a ver la evolución." Sin rondas analizadas → el EmptyState de arriba.
- La foto del polígono (M03) y las de la grilla (W02) abren el visor.

### M06a / W04a · Análisis: calibración — "Inclinación" con perspectiva
- El botón **Forma** pasa a llamarse **Inclinación**. Arrastrar inclina el blanco en 3D: el lado hacia el que se arrastra se acerca (se ve más grande) y el opuesto se aleja. Los anillos verdes se dibujan con perspectiva: elipses que ya no son concéntricas (su centro se corre hacia el lado lejano) ni igual de aplastadas.
- El punto del anillo queda fijo: los anillos siempre pasan por él (la escala sale de ahí).
- Debajo de la instrucción, el texto "Inclinación: 30° hacia abajo" mientras haya inclinación. Hasta 70°.
- "Volver a círculos" pasa a ser **Quitar la inclinación**.
- La explicación del panel cambia "La foto tiene que estar sacada de frente." por "Si la foto está sacada en ángulo, elegí «Inclinación» y arrastrá hasta que los anillos coincidan."
- En la maqueta, la foto de ejemplo está sacada desde abajo con 30° de inclinación: sin inclinar, los anillos verdes no coinciden.

### M06 / W04 · Análisis: PMI con X / Y
- La tarjeta del PMI suma una línea con sus coordenadas desde el centro, con signo, como un par: "(−4,1; −13,2)", igual en mobile y desktop, en 13 px. X positiva a la derecha, Y positiva hacia arriba (como la tabla de impactos). Unidad del perfil (la de la tarjeta); un decimal en mm, dos en pulgadas. Los lectores de pantalla leen "X −4,1, Y −13,2".

### M07 / W05 · Rendimiento — valor en cada punto
- **Tamaño de grupo pasa de barras a línea**, como el puntaje (escala ajustada a los valores, no desde 0; sigue la nota "Menor es mejor"). Los dos gráficos usan el acento naranja.
- Cada punto lleva siempre su valor encima, sin unidad (la unidad está en el título). El punto destacado (el último, o el que se toca) lo muestra más grande.
- Cada punto ocupa al menos **52 px**. Si no entran, el área del gráfico se desplaza en horizontal (`overflow-x: auto`, arranca mostrando los más recientes) y el **eje y queda fijo** a la izquierda.
- Eje x: la fecha del punto destacado, resaltada; del resto, las que entran sin superponerse.
- El tooltip al tocar ya no agrega el valor arriba (ya está): solo destaca el punto y su fecha.

## Cambios en `pantallas.md` (al cerrar la iteración)
- M03 / W02: pestañas Rondas / Evolución (`?vista=evolucion`), la tarjeta Evolución y la apertura del visor.
- M06: "Inclinación" (reemplaza la descripción de "Forma"), PMI con X / Y en la tabla de métricas ("Cruz sobre la foto + desvío del centro en mm, dirección en horas de reloj y coordenadas X / Y").
- M07: valores en todos los puntos y desplazamiento horizontal.
- Nueva sección M13 / W08 · Visor de fotos y su fila en el mapa de rutas.
- Comportamiento PWA: `name` y `short_name` "Range Book".
- El nombre visible de la app pasa a ser **"Range Book"** en todos lados (logo del login y del sidebar, login mobile, instrucciones de instalación de Perfil, títulos). No cambia el diseño del logo.

## Cambios en `design-system.md` (al cerrar la iteración)
- Componentes nuevos: `PhotoViewer` (visor a pantalla completa), `MpiScatter` (dispersión de PMI), `SessionEvolution` (tarjeta con el control segmentado y los gráficos).
- Se elimina `BarChart`: los gráficos por sesión o por ronda son todos `LineChart`.
- `LineChart`: valor en cada punto, ancho mínimo por punto, desplazamiento horizontal con el eje y fijo; el eje x acepta etiquetas que no son fechas ("R1").
- `MarkerPicker`: Centro / Anillo / **Inclinación**. `CalibrationPanel`: texto de la inclinación y "Quitar la inclinación".
- `MetricTile` del PMI: línea de coordenadas.
- `Photo` como disparador del visor: cursor `zoom-in` y botón accesible "Ver la foto N en pantalla completa".
- Íconos: Cerrar `X`, Foto anterior `ChevronLeft`, Foto siguiente `ChevronRight` (ya son de Lucide).
