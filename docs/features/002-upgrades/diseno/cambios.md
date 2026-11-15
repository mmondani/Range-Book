# Cambios de diseño — 002 Upgrades

**Maqueta:** [`maqueta/index.html`](./maqueta/index.html) (solo las pantallas modificadas).

## Pantallas nuevas
Ninguna.

## Pantallas modificadas

### M06a / W04a · Análisis: calibración sin centro automático
- **Se quita el centro automático.** Al cargar la foto ya no se busca el centro ni se muestra "Buscando el centro…". Se quita el aviso "El centro se ubicó automáticamente…".
- La calibración arranca siempre con **Centro** activo, también en los blancos con anillos.
- **Ubicar un punto no pasa solo al siguiente**, con ningún marcador (Centro, Anillo, Punto A, Punto B). El usuario cambia de marcador con los botones de arriba de la foto. Los ✓ siguen marcando los que ya están ubicados.
- La instrucción del centro pasa a ser: "Tocá el centro del blanco. Cuando esté en su lugar, elegí «Anillo»." (en blancos sin zonas: "… elegí «Punto A»."). La del punto A: "Tocá el punto A. Cuando esté en su lugar, elegí «Punto B»."
- Al reabrir un análisis guardado y tocar "Recalibrar la foto", arranca en Centro, como hoy.

### M06 / W04 · Análisis: impactos (sin cambios visuales)
No cambia la pantalla, solo su comportamiento (por eso no está en la maqueta):
- **Detectar automáticamente** propone como máximo tantos impactos como **disparos declarados** en la ronda: si encuentra más candidatos, se queda con los que más se parecen a un agujero. Agregar a mano sigue permitido por encima de esa cantidad (y sigue el aviso de que no coinciden).
- **Puntaje:** un impacto cuyo agujero toca la línea de un anillo suma el valor de la zona de adentro. El agujero se toma del calibre del arma de la sesión (9 mm si no se reconoce). Vale para el puntaje, la distribución, la zona de la tabla de impactos (W04) y la etiqueta accesible de cada impacto.

### M06 / W04 · Análisis: "Radio medio" en lugar de "Al centro"
No está en la maqueta: solo cambia el texto y el valor de una tarjeta.
- La tarjeta **"Al centro" / "Dist. al centro"** pasa a **"Radio medio"** (mobile y desktop). Su ayuda dice "Prom. al PMI" en lugar de "Prom. por tiro". El valor es la distancia media de los impactos al PMI, en mm o pulgadas según el perfil.
- Los análisis guardados se reprocesan (ver el plan), así que los viejos también muestran el radio medio.

### M03 / W02 · Detalle de sesión — Evolución
**"Al centro" se reemplaza por "Radio medio"** en el control segmentado: **PMI / Grupo / Radio medio**. Su línea se titula "Radio medio (mm)" y muestra la distancia media de los impactos a su PMI en cada ronda. El EmptyState dice "…cómo evolucionan el PMI, el grupo y el radio medio".

**Grupo y Radio medio suman una dispersión con círculos**, debajo de su línea:
- **Grupo:** título "Grupo de cada ronda". Cada ronda es su PMI (punto numerado, como en PMI) con un círculo punteado **centrado en el PMI** cuyo **diámetro es el tamaño de grupo** de la ronda. Leyenda: "Cada círculo está centrado en el PMI de la ronda y su diámetro es el tamaño de grupo."
- **Radio medio:** título "Radio medio de cada ronda". Mismo gráfico, con el círculo **centrado en el PMI** y de **radio igual al radio medio** de la ronda. Leyenda: "Cada círculo está centrado en el PMI de la ronda y su radio es el radio medio: la distancia media de los impactos a ese PMI."
- Los círculos usan el color de información (`--info`, el del PMI) punteado, con opacidad media para que se lean superpuestos. La escala del gráfico incluye los círculos enteros; los círculos de referencia y su medida siguen como en PMI.
- Las rondas con menos de dos impactos no tienen grupo: en Grupo se ven sin círculo.
- Respetan la unidad elegida (mm / pulg / MOA).

**Tocar un PMI** (en las tres dispersiones: PMI, Grupo y Radio medio):
- El punto tocado se resalta (más grande, opaco) junto con su círculo (trazo más grueso); los demás puntos, sus círculos y el recorrido punteado se opacan. Sin selección, se ve como hoy (la última ronda resaltada).
- Debajo del gráfico, una franja (`surface-2`, radio 12) muestra la ronda tocada: "**Ronda 3**" y, en 13 px, "PMI (1,5; −8,4) · Grupo 41,0 mm" (en Radio medio, "· Radio medio 12,0 mm"; en PMI, solo las coordenadas) y, a la derecha, el link **Ver análisis** (abre el análisis de esa ronda, igual que su tarjeta en Rondas). Sin selección, la franja dice "Tocá un punto para ver esa ronda. Pellizcá el gráfico para acercarlo." en `text-3`. La franja reserva su alto para que el contenido no salte.
- Tocar el mismo punto o un lugar vacío del gráfico quita la selección.
- Cada punto tiene un área de toque de al menos 44 px. Con teclado, los puntos son botones ("Ronda 3", `aria-pressed`) que se recorren con Tab; Enter o Espacio los seleccionan y Escape quita la selección. La franja es `role="status"`.

**Selección compartida** (toda la tarjeta Evolución):
- **Hay una sola ronda seleccionada para toda la Evolución.** Si se elige la ronda 3 en PMI, al pasar a Grupo o a Radio medio sigue seleccionada: su PMI y su círculo resaltados, los demás opacados y su franja con "Ver análisis". Lo mismo al cambiar de unidad.
- **Tocar una ronda en el gráfico de línea la selecciona** en la dispersión de abajo y en las otras pestañas, igual que tocar su PMI. Tocar de nuevo la ronda seleccionada, en la línea o en la dispersión, quita la selección en todos. También la quitan tocar un lugar vacío de la dispersión y Escape.
- **En la línea, la ronda seleccionada se marca con una banda vertical translúcida** detrás de su punto. Va de arriba del gráfico hasta el eje x, incluido su "R3", y mide 44 px de ancho (menos si la franja de la ronda es más angosta), con radio 8. Es del color del PMI (`--info`): relleno al 14 % y borde de 1 px al 35 %, para que se lea como la misma ronda resaltada en la dispersión. Su punto, su valor y su "R3" se ven destacados, como el punto destacado de hoy. Si la línea tiene desplazamiento horizontal y la ronda no se ve, se lleva a la vista.
- **Pasar el mouse por la línea** sigue destacando el punto bajo el cursor, sin seleccionarlo. La banda, el valor y el "R3" de la seleccionada no se mueven. Al salir, el destacado vuelve a la seleccionada o, si no hay, a la última.
- **Teclado y lectores de pantalla:** en la Evolución, cada ronda de la línea es un botón ("Ronda 3", `aria-pressed`). Enter o Espacio la seleccionan o la quitan, y Escape quita la selección.
- Sin selección, todo se ve como antes: la última ronda destacada en la línea y en la dispersión.
- La selección vive mientras se mira la sesión: no se guarda ni va en la URL.

**Zoom** (en las tres dispersiones: PMI, Grupo y Radio medio):
- **Pellizcar con dos dedos** acerca o aleja alrededor del punto entre los dedos, de **1× a 8×**. En desktop, el pellizco del trackpad o **Ctrl + rueda** hace lo mismo alrededor del cursor. La rueda sola sigue desplazando la página.
- **Con zoom (> 1×), arrastrar con un dedo** (o con el mouse) desplaza el gráfico, sin poder sacarlo de su recuadro. A 1×, un dedo desplaza la página, como hoy.
- **Solo se separan los puntos:** los PMI, sus números, los trazos y los textos mantienen su tamaño. Los círculos de cada ronda y los de referencia crecen con la escala. Lo que queda fuera del recuadro se recorta.
- **Los círculos de referencia se recalculan** para la escala visible: a 1×, "20 mm / 10 mm"; acercando, "10 mm / 5 mm", "5 mm / 2,5 mm"… Así siempre hay una medida legible.
- **Controles sin gestos**, debajo del gráfico a la derecha (grupo "Zoom del gráfico"): botones **−** ("Alejar") y **+** ("Acercar"), que cambian ×1,6 alrededor del centro, el nivel actual ("2,6×", `aria-live`) y **1×** ("Restablecer el zoom"). Son de 44 × 44 px, con borde, `surface-2` y radio 12. − y 1× se deshabilitan a 1×, y + a 8×.
- **Un pellizco o un arrastre no cuenta como toque:** no selecciona ni deselecciona. La selección se mantiene al hacer zoom.
- **Cambiar de PMI / Grupo / Radio medio o de unidad vuelve a 1×.** La selección se mantiene (ver abajo).

## Cambios en `pantallas.md` (al cerrar la iteración)
- M06: quitar "Centro automático"; "Al ubicar un punto pasa solo al siguiente" pasa a "Ubicar un punto no cambia el marcador activo"; el estado "buscando el centro".
- M06, tabla de métricas: el puntaje usa la regla de "toca la línea" con el diámetro del proyectil; "Detectar automáticamente" propone hasta los disparos declarados.
- Decisiones tomadas: la fila "Regla de «toca la línea»" cambia a "Aplica: cuenta el valor superior si el agujero toca la línea (diámetro según el calibre)".
- M06, tabla de métricas: la fila **Distancia al centro** pasa a **Radio medio** (*Mean Radius*): "Promedio de la distancia de cada impacto al PMI". Se borra la nota de que el radio medio se había quitado.
- M03: "Al centro" pasa a "Radio medio"; las dispersiones de Grupo y Radio medio y la selección de un PMI con "Ver análisis", compartida entre las pestañas y con la línea; el zoom con dos dedos (y sus botones) en las tres dispersiones.

## Cambios en `design-system.md` (al cerrar la iteración)
- `MpiScatter`: círculos opcionales por punto, selección de un punto (resaltado y opacado), franja de detalle con link y zoom (pellizco, Ctrl + rueda, arrastre con zoom y botones − / nivel / + / 1×).
- `LineChart`: selección opcional (`selectedIndex` / `onSelect`). Cuando se pasa, cada punto es un botón con `aria-pressed` y el seleccionado lleva la banda vertical translúcida `--info`. Rendimiento no la usa.
- `CalibrationPanel`: sin el aviso del centro automático.
- `MetricTile`: "radio medio" en lugar de "distancia al centro".

## Cambios en la maqueta general (al cerrar la iteración)
- `docs/diseno/maqueta/` M06 / W04 (`analisis.html` y `assets/analyzer.js`): la tarjeta "Al centro" pasa a "Radio medio", calculado desde el PMI.
- `docs/diseno/maqueta/assets/frame.css`: definir `--info: #5AA9FF` en el tema oscuro (como en `src/styles/tokens.css`). Hoy falta, así que la dispersión de la Evolución pinta los PMI en negro.
