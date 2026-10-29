# Pantallas — Range Book

**Estado:** Implementado hasta la iteración 001 (Fixes)
**Requerimientos:** [requerimientos del MVP](../features/000-mvp/requerimientos.md) · **Métricas:** [shooting_metrics.md](../features/000-mvp/shooting_metrics.md) · **Sistema de diseño:** [design-system.md](./design-system.md)
**Maqueta:** [`maqueta/index.html`](./maqueta/index.html): HTML estático; se abre con doble clic en el navegador.

> Los datos de ejemplo de la maqueta (armas, polígonos, puntajes) son ilustrativos y no siempre coinciden entre una pantalla y otra.
> Los textos entre corchetes (`[Foto…]`, `[Dirección…]`) son espacios reservados.

## Mapa de navegación y rutas

| Ruta | Mobile | Web | Archivo de la maqueta |
|---|---|---|---|
| `/login` | M01 | W01 | `mobile/login.html`, `web/login.html` |
| `/sesiones` | M02 | W02 (lista + detalle) | `mobile/sesiones.html`, `web/sesiones.html` |
| `/sesiones/nueva`, `/sesiones/:id/editar` | M04 | W03 | `mobile/sesion-form.html`, `web/sesion-form.html` |
| `/sesiones/:id` | M03 | W02 (panel derecho) | `mobile/sesion-detalle.html` |
| `/sesiones/:id/rondas/nueva`, `…/rondas/:rid/editar` | M05 (sheet sobre M03) | diálogo sobre W02 | `mobile/ronda-form.html` |
| `/sesiones/:id/rondas/:rid/analisis` | M06 (calibración y análisis) | W04 | `mobile/analisis-calibracion.html`, `mobile/analisis.html`, `web/analisis-calibracion.html`, `web/analisis.html` |
| `/rendimiento` (filtros en la query string) | M07 | W05 | `mobile/rendimiento.html`, `web/rendimiento.html` |
| `/inventario/:categoria` (`armas`, `configuraciones`, `municiones`, `poligonos`, `blancos`); `/inventario` va a `armas` | M08 | W06 | `mobile/inventario.html`, `web/inventario.html` |
| `/inventario/municiones/nueva`, `/inventario/poligonos/nuevo`, `/inventario/configuraciones/nueva`, `/inventario/:categoria/:id/editar` | sheet sobre M08 | diálogo | — |
| `/inventario/armas/nueva`, `/inventario/armas/:id/editar` | M10 (sheet) | diálogo | `mobile/arma-form.html` |
| `/inventario/armas/:id` (+ `modificaciones/nueva`, `modificaciones/:id/editar`, `configuraciones/nueva`, `configuraciones/:id/editar`) | M09 | W07 | `mobile/arma-detalle.html`, `web/arma-detalle.html` |
| `/inventario/blancos/nuevo`, `/inventario/blancos/:id/editar` | M12 | diálogo | `mobile/blanco-form.html` |
| `/perfil` | M11 | columna de 640 px | `mobile/perfil.html` |
| Visor de fotos (sin ruta propia: va en el estado del historial) | M13 | W08 | `mobile/visor-fotos.html`, `web/visor-fotos.html` |
| `/sesiones/:id?vista=evolucion` | M03, pestaña Evolución | W02, pestaña Evolución | `mobile/sesion-detalle.html`, `web/sesiones.html` |

- Todas las rutas, menos `/login`, requieren sesión **y** que el email esté en la colección de autorizados.
- Los sheets y diálogos tienen su propia URL, así el botón "atrás" del sistema los cierra. Al cerrar o guardar, si se abrieron desde la lista se vuelve atrás en el historial; si se entró directo por URL, se reemplaza la entrada. La única excepción son las instrucciones de instalación en iOS (M11), que son solo informativas.
- Al volver a una lista se conservan los filtros (van en la query string). El scroll todavía no se restaura.
- No hay menús "⋮": las acciones (editar, archivar, eliminar) son botones visibles o están dentro del sheet de edición.
- Las páginas completas con su propia barra de acción (M03, M04, M06) ocultan la barra inferior en mobile.

## Pantallas

### M01 / W01 · Login
- Logo, nombre y propuesta de valor. Una sola acción: **Continuar con Google** (botón blanco, según la guía de marca de Google).
- **Estados:** inicial · cargando (botón con spinner) · **no autorizado** (alerta roja con el email usado y el texto "probá con otra cuenta o pedí acceso"; se muestra en W01) · error de red (alerta con "Reintentar").
- Si el usuario autenticado no está autorizado, se cierra la sesión de Firebase y se muestra la alerta.

### M02 · Sesiones (inicio) / W02 · Sesiones lista + detalle
- Header: título, buscar y filtrar. En mobile, "Buscar" y "Filtrar" abren el campo y los chips de arma debajo del resumen. La búsqueda (`?q=`) y el filtro por arma (`?arma=`) van en la query string.
- Resumen del mes (solo mobile): sesiones, disparos y promedio por tiro. Desktop muestra "N en total".
- Lista agrupada por mes con `SessionCard`. La sesión de hoy se destaca.
- Mobile: FAB **Nueva sesión**. Desktop: botón primario en el sidebar; búsqueda y chips de arma arriba de la lista; detalle de la sesión seleccionada a la derecha, con la tabla de rondas (foto, ronda y blanco, distancia, disparos, puntaje, grupo, comentarios, estado del análisis y acciones "Ver análisis" / "Analizar blanco" y editar). Un clic en cualquier parte de la fila (salvo sus links y botones) lleva al análisis; la fila se resalta al pasar el mouse.
- **Estados:** vacío ("Todavía no registraste sesiones" + Nueva sesión) · cargando (skeletons) · sin resultados de búsqueda.

### M03 · Detalle de sesión
- Fotos del polígono arriba (`PhotoStrip`: se desliza de a una, con "1 / 3 fotos"), con los botones volver, editar y **eliminar** encima. Sin fotos, los botones quedan arriba sin fondo. En desktop, "Editar" y "Eliminar" van en el encabezado y las fotos en una grilla. Tocar una foto la abre en el visor (M13 / W08).
- Fecha, configuración (título) y chips de personalizaciones.
- Datos: polígono, clima y munición en una tarjeta; los totales, en otra fila.
- Totales: disparos, puntaje (obtenido / máximo) y tamaño de grupo promedio de las rondas analizadas.
- **Pestañas Rondas / Evolución** (`Tabs`: chips en mobile, subrayadas en desktop), debajo de los totales. "Rondas N" viene elegida; la elegida va en la query string (`?vista=evolucion`; Rondas no aparece) sin pisar los filtros de la lista, y cambiar de pestaña reemplaza la entrada del historial. Así se conserva al volver del análisis o al recargar.
- **Rondas:** `RoundRow` con miniatura (la foto de la ronda o el dibujo del blanco), "disparos · puntaje · grupo", "blanco · **distancia** · comentarios", estado *Analizada* o *Sin analizar* y el link "Ver análisis" / "Analizar blanco". **Toda la tarjeta lleva al análisis**; el lápiz "Editar ronda N" abre M05. En desktop, "Agregar ronda" va a la derecha de las pestañas, solo con Rondas.
- **Evolución** (`SessionEvolution`), una ronda analizada por punto (eje x "R1, R2…", con el número de la ronda en la sesión):
  - Nota "Por ronda analizada · N de M" y, a la derecha, el control **mm | MOA** ("in | MOA" en pulgadas). MOA se calcula a la distancia de cada ronda. Por defecto, la unidad del perfil; MOA si las rondas analizadas son a distancias distintas. La elección no se guarda.
  - Control segmentado **PMI / Grupo / Al centro**. PMI: línea con el desvío del PMI y, debajo, la dispersión de los PMI de cada ronda alrededor del centro (`MpiScatter`: ejes, dos círculos de referencia con su medida, puntos numerados por ronda, recorrido punteado y la última resaltada). Grupo y Al centro: una línea cada uno. Los títulos dicen la unidad.
  - **Estados:** sin rondas analizadas, EmptyState "Todavía no hay rondas analizadas"; con una, "Con dos rondas analizadas o más vas a ver la evolución."
- Notas, debajo de las pestañas (se ven con las dos).
- Barra fija: **Agregar ronda** (reemplaza a la barra inferior). En desktop, "Agregar ronda" va en el encabezado de la sección.
- Eliminar la sesión pide confirmación y ofrece "Deshacer" en un toast.

### M04 / W03 · Nueva / editar sesión
- Campos: **Arma / configuración*** (un select con un grupo por arma: "Stock" y sus configuraciones activas; no se precarga) · **Munición*** (junto al arma, porque su default depende de ella: la de la última sesión con esa arma) · **Personalizaciones** (chips precargados desde la configuración; se pueden quitar, y "Agregar" despliega debajo los chips de las modificaciones activas que faltan) · **Fecha*** (hoy por defecto; no futura) · **Polígono*** (el de la última sesión) · **Clima** (opcional; chips Soleado, Nublado, Lluvioso, Niebla, Ventoso; tocar el elegido lo desmarca) · **Fotos del polígono** (cámara / galería, hasta 20) · **Notas** (hasta 2000 caracteres).
- Si el último polígono o munición se archivó, se propone el anterior que siga activo.
- Al guardar, la sesión copia las personalizaciones elegidas (**snapshot**: marca y modelo de cada modificación). Si después se edita o archiva la configuración o una modificación, el historial de la sesión no cambia.
- Las rondas **no** se cargan acá: se agregan desde el detalle, a medida que se tira. Así la sesión se crea en segundos al llegar al polígono.
- Validación al salir del campo. Al guardar con errores, foco en el primer campo inválido.
- Salir con cambios sin guardar (cerrar, Cancelar, "atrás" u otra sección) pide confirmación.
- Borrador local mientras haya cambios: al volver se recupera con el aviso "Recuperamos los cambios que no guardaste" y el botón "Descartar borrador". Las fotos todavía sin subir no entran en el borrador.
- Barra fija **Guardar sesión** (reemplaza a la barra inferior).

### M05 · Agregar ronda (sheet)
- Eyebrow: la fecha de la sesión. Campos: **Blanco*** (del ABM; el último usado que siga activo) · **Distancia*** en metros (hasta 2000; coma o punto decimal) · **Disparos*** (stepper, 1 a 999) · **Puntaje** (entero, opcional; la ayuda muestra el máximo posible) · **Foto del blanco** (cámara / galería) · **Comentarios** (hasta 500).
- La "ronda anterior" es la última de la sesión o, si no tiene, la última de la sesión más reciente: de ella salen la distancia y los disparos (sin rondas anteriores: sin distancia y 10 disparos). En el alta, un aviso dice que se precargaron.
- Si la ronda tiene un puntaje confirmado por el análisis, la ayuda del campo "Puntaje" lo menciona; el campo sigue siendo el cargado a mano.
- Si una ronda analizada cambia de foto o de blanco, se avisa debajo de la foto que al guardar se descarta su análisis.
- Al editar: **Eliminar ronda** (con confirmación y "Deshacer"). Una sesión admite hasta 100 rondas.
- Al editar una ronda con foto guardada y sin cambios sin guardar, debajo de la foto aparece el link "Analizar impactos" / "Ver análisis" (el análisis es sobre la foto guardada).
- Si la ronda se analiza, el análisis **propone** el puntaje calculado y el usuario lo confirma (ver M06). Sin confirmación se conserva el puntaje cargado a mano.
- Acciones: Cancelar / **Guardar ronda**. Al guardar una ronda **nueva con foto** se pasa a su análisis (reemplaza al sheet en el historial: "Volver" desde el análisis lleva al detalle); sin foto, o al editar, vuelve al detalle.

### M06 / W04 · Análisis de blanco
Página completa (también en desktop, sin la lista de sesiones). Al entrar, la página arranca arriba. Tiene dos etapas: la calibración de la foto y el análisis de los impactos.

**Visor de la foto** (`TargetAnalyzer`, igual en las dos etapas)
- Recuadro de proporción fija: **5:6** en mobile y **1:1** en desktop. La foto arranca cubriendo el recuadro, centrada en su centro; lo que sobra queda afuera y se desplaza.
- **Zoom propio**, dentro del recuadro (la página no se mueve): botones **Acercar**, **Alejar** y **Ver la foto entera** abajo a la derecha (hasta 10× de la foto entera). En mobile, dos dedos acercan, alejan y desplazan; con la foto más grande que el recuadro, un dedo la desplaza (salvo al calibrar, donde un dedo arrastra el marcador). En desktop, Ctrl + rueda (o el pellizco del trackpad) acerca donde está el cursor y la rueda desplaza. Un toque que se mueve más de 8 px es un desplazamiento: no agrega ni quita impactos.
- Marcadores, impactos, PMI y trazos mantienen su tamaño en pantalla con cualquier zoom. Los colores de las superposiciones son fijos (ver `design-system.md` → Color).

**1 · Calibración** (`analisis-calibracion.html`): se muestra en un análisis nuevo y con "Recalibrar la foto".
- **Blanco con anillos:** el **centro** y un punto sobre un **anillo** de diámetro conocido. **Sin zonas:** el centro y dos puntos **A** y **B** a una distancia conocida.
- **Qué ajustar** (botones sobre la foto, arriba a la izquierda): Centro / Anillo / **Inclinación** (o Centro / Punto A / Punto B). El activo se ve con borde verde; los ya ubicados llevan ✓. Al ubicar un punto pasa solo al siguiente que falte.
- **Centro automático:** en un blanco con anillos, al cargar la foto se busca el centro y queda ubicado ("Buscando el centro…" sobre la foto); el activo pasa a "Anillo" y el panel avisa: "El centro se ubicó automáticamente. Si no coincide con el de la foto, elegí «Centro» y tocalo." Si no hay un centro claro, se toca a mano.
- Cada punto se ubica tocando la foto o **manteniendo apretado y arrastrando**: el marcador sigue al dedo y los anillos verdes se redibujan en vivo. Con el dedo, el arrastre empieza a los 100 ms: si antes se apoya un segundo dedo, el gesto es un zoom y el marcador no se mueve.
- **Inclinación** (foto en ángulo): mantener apretado y arrastrar inclina el blanco en 3D, a partir de cómo estaba (0,02 rad por cada 1 % del lado mayor arrastrado, hasta 70°). El lado hacia el que se arrastra se acerca y se ve más grande; los anillos verdes se dibujan con perspectiva (elipses que ya no son concéntricas). El punto del anillo no se mueve: los anillos siempre pasan por él. Un toque sin arrastrar no cambia nada. "Quitar la inclinación" vuelve a círculos. Las medidas siguen a la perspectiva (puntaje, grupo, PMI y distancias quedan compensados; ver [ADR 0006](../decisiones/0006-inclinacion-con-perspectiva.md)). Los blancos sin zonas no tienen inclinación.
- **Calibraciones viejas** con la "Forma" del MVP (elipse afín): se ven igual que antes. Al recalibrar, "Inclinación" aparece con ✓ y el panel avisa "Esta foto se calibró con la forma anterior de los anillos. Si la inclinás, se reemplaza por la inclinación."
- Panel "Calibrar la foto": la explicación, la instrucción del punto activo, el aviso del centro automático, la inclinación ("Inclinación: 30° hacia abajo") y "Quitar la inclinación", el select **Anillo marcado** ("8 puntos · Ø 150 mm"; por defecto, el tercero desde el centro) o el campo **Distancia entre A y B** (por defecto, el tamaño de referencia del blanco) y el error si falta algo.
- Los anillos calibrados (y la línea A–B) se dibujan en verde. Acción primaria: **Continuar**. La primera vez, al continuar se detectan los impactos solos.

**2 · Impactos** (`analisis.html`)
- Foto del blanco con los impactos superpuestos (anillo naranja sin relleno, para que se vea el agujero). El **PMI** se marca con una cruz azul y el **grupo** con un círculo punteado alrededor del PMI (una elipse, si la calibración tiene forma).
- Modos: **Detectar automáticamente** (rehace la detección) · **Agregar** (tocar o hacer clic sobre el blanco) · **Quitar** (tocar un impacto; el anillo se ve rojo). Además, **Deshacer** con historial (deshabilitado sin historial).
- Aviso cuando los impactos marcados no coinciden con los disparos declarados.
- **Confirmación del puntaje:** un checkbox "Usar el puntaje calculado (N) en la ronda" muestra también el puntaje cargado a mano. En un análisis nuevo viene marcado: guardar así es la confirmación. Al reabrir uno guardado, conserva lo que se eligió. Si el usuario lo desmarca, se conserva el puntaje cargado a mano.
- "Recalibrar la foto" (debajo de las métricas) vuelve a la calibración; los impactos quedan donde están sobre la foto y cambian sus medidas.
- W04 suma una tabla de impactos (#, zona, X/Y desde el centro, quitar), que además es la alternativa accesible para quitar sin precisión de puntero.
- Salir con cambios sin guardar pide confirmación ("¿Descartar el análisis?").
- **Estados:** buscando el centro y detectando (overlay con progreso sobre la foto) · detección fallida (aviso + marcado manual) · sin foto ("Esta ronda no tiene foto" con "Agregar foto") · blanco sin zonas (en lugar del puntaje calculado, el texto "Este blanco no tiene zonas: el puntaje de la ronda es el cargado a mano.").

**Métricas del MVP** (sección 8 de `shooting_metrics.md`), calculadas en vivo. Los impactos se guardan en mm respecto del centro del blanco (x a la derecha, y hacia arriba); la escala sale de la calibración de la foto (anillo de diámetro conocido, con su forma si la foto está en ángulo, o dos puntos a una distancia conocida).

| Métrica | Definición | Cómo se muestra |
|---|---|---|
| **Puntaje** (*Score detection*) | Suma, por impacto, del puntaje de la zona más chica que contiene **el centro del impacto** (0 si cae fuera). No se usa el diámetro del proyectil: no aplica la regla de "toca la línea" | Total / máximo posible y promedio por tiro |
| **Distribución de puntaje** (*Score Distribution*, sección 1) | Cantidad de impactos por zona | Chips "10 × 4 · 9 × 5 · …" |
| **Tamaño de grupo** (*Group Size*) | Dispersión extrema: distancia máxima centro a centro entre dos impactos | mm y su equivalente en MOA a la distancia de la ronda (1 MOA = 0,2909 mm por metro) |
| **PMI** (*Mean Point of Impact*) | Promedio de las coordenadas de los impactos | Cruz sobre la foto + desvío del centro en mm, dirección en horas de reloj y coordenadas con signo "(−4,1; −13,2)" (13 px; los lectores de pantalla leen "X −4,1, Y −13,2") |
| **Distancia al centro** (*Distance from Center*) | Promedio de la distancia de cada impacto al centro del blanco | mm |

- La implementación va en `src/lib/` (funciones puras con tests). `maqueta/assets/analyzer.js` sirve de referencia de cálculo y de interacción.
- El radio medio del prototipo anterior se quitó porque no está en el alcance que define `shooting_metrics.md`.
- **Fuera del MVP** (sección 8, "Then add"): heatmaps, CEP, tendencias por impacto. También desvío estándar, detección de *flyers* y orden de los disparos. El modelo de impactos en mm ya los permite más adelante.

### M07 / W05 · Rendimiento
- Filtros, en este orden: **configuración** (cada arma virtual por separado; el arma base sin modificaciones es su propia configuración "Stock"), munición, **distancia**, blanco, polígono y período. En mobile son chips (resaltados si el filtro está aplicado) que abren un sheet con las opciones (`?filtro=`, "atrás" lo cierra); en desktop, selects. Todo va en la query string; un filtro con su valor por defecto no aparece.
- Cada filtro ofrece solo lo que aparece en alguna sesión (archivados incluidos). Por defecto: últimos 90 días y la **distancia más usada** ("La más usada (25 m)"). "Todas" mezcla distancias, y entonces el grupo y el PMI se comparan en **MOA**.
- KPIs: **promedio por tiro** y **tamaño de grupo** con delta contra el período anterior ("▲ 0,5 (mejor)", en verde o rojo según si mejoró; "Igual que el período anterior"; sin delta en "Todo"). **Desvío del PMI** con su tendencia ("Tendencia hacia las 7 h") y **disparos** con "N sesiones · N rondas". Medidas con un decimal (`46,0 mm`); promedio por tiro con uno (`9,1`).
- Gráficos de línea (un punto por sesión, escala ajustada a los valores): puntaje promedio y tamaño de grupo ("menor es mejor"). Los títulos dicen la distancia y la unidad ("Por sesión · a 25 m", "Tamaño de grupo (mm)"). **Cada punto lleva su valor** (sin unidad); el último, o el que se toca o se señala, se destaca más grande y muestra su fecha resaltada en el eje x. Del resto, el eje x muestra las fechas que entran sin pisarse.
- Cada punto ocupa al menos 52 px: si no entran, el gráfico se desplaza en horizontal (arranca mostrando las sesiones más recientes; también con el teclado) y el eje y queda fijo.
- Mobile: comparación por munición (barras horizontales, solo con dos municiones o más; la mejor ocupa todo el ancho). Desktop: tabla por sesión ordenable (Fecha, Disparos, Prom./tiro, Grupo, Desvío PMI; la fecha y la fila llevan al detalle) y "Exportar CSV" (`;`, coma decimal, con polígono, rondas y dirección del PMI).
- **Estados:** sin análisis todavía (EmptyState "Analizá tus blancos para ver la evolución" + "Ir a sesiones") · pocos datos (menos de 2 sesiones: solo KPIs y "Con dos sesiones o más vas a ver la evolución en gráficos") · sin datos para los filtros ("Limpiar filtros" o "Ver todo el historial").

### M08 / W06 · Inventario
- Categorías: **Armas · Configuraciones · Munición · Polígonos · Blancos**, con su contador. En mobile son chips; en desktop, tabs.
- El botón primario cambia según la categoría y usa el texto completo también en mobile ("Nueva arma", "Nueva munición", …). La búsqueda está solo en desktop y filtra la categoría actual.
- Mobile muestra una lista dentro de una tarjeta; desktop, una tabla. Cada fila tiene un lápiz "Editar …"; **Archivar** está dentro del sheet de edición.
- Armas: tarjeta con foto, marca y modelo, calibre, cantidad de modificaciones y tiros acumulados.
- Configuraciones: nombre, arma base, modificaciones y sesiones.
- Munición (marca*, modelo*, descripción) y Polígonos (nombre*, dirección): listas o tablas. **Alta y edición en sheet o diálogo** (formularios cortos, mismo patrón que M05; se validan al guardar).
- Blancos: grilla de tarjetas con foto (o el dibujo de sus anillos), nombre y resumen de la geometría ("Anillos · Ø 500 mm · 10 zonas" o "Sin zonas · puntaje manual"). La tarjeta abre la edición (M12).
- **Archivar en lugar de borrar:** armas, modificaciones, configuraciones, municiones, polígonos y blancos no se borran, se archivan. Un elemento archivado no aparece en los selects de sesión y ronda ni en las listas, pero sigue visible en el historial y en Rendimiento. Se ve con el checkbox "Mostrar archivados (n)" (en los dos tamaños, solo si hay archivados; `?archivados=1`): se listan al final, atenuados, con el badge "Archivado" y el botón "Restaurar". Archivar no pide confirmación: muestra un toast con "Deshacer".
- Las sesiones y las rondas sí se eliminan (con confirmación y "Deshacer"), porque nada las referencia.

### M09 / W07 · Detalle de arma
- Galería (portada y miniaturas; las fotos se agregan y ordenan desde Editar), marca y modelo, calibre. Tocar la foto principal la abre en el visor (M13 / W08).
- Encabezado con **Editar** y **Archivar** (o **Restaurar**, con el badge "Archivada") en los dos tamaños. Mobile tiene "‹ Armas"; desktop, la ruta Inventario / Armas / arma.
- **Tiros acumulados** = tiros previos al registro + suma de los disparos de las sesiones.
- Datos de compra.
- **Modificaciones**: lista con marca, modelo y comentarios, con un lápiz por fila. Alta, edición y archivo en sheet. "Mostrar modificaciones archivadas" y "Mostrar configuraciones archivadas" son checkboxes separados.
- **Configuraciones** (armas virtuales): nombre, modificaciones incluidas y sesiones. "Nueva configuración" abre un sheet con el nombre y checkboxes de las modificaciones activas del arma (al menos una; el nombre no puede ser "Stock" ni repetir el de otra configuración activa del arma).

### M10 · Alta / edición de arma
- Sheet en mobile, diálogo en desktop, como el resto del inventario. Al crear un arma, se abre su detalle.
- Fotos (hasta 20; la primera es la portada) · **Marca*** · **Modelo*** · **Calibre*** (con sugerencias) · Fecha de compra (no futura) · Lugar de compra · Tiros previos al registro (0 a 10.000.000).
- Al editar: **Archivar arma**.
- La maqueta muestra un error de validación en "Modelo" como ejemplo del patrón.

### M11 · Perfil
- Avatar (foto de Google), nombre, email y resumen (sesiones, disparos, armas).
- Preferencias: **unidades** (mm / pulgadas) · **tema**: Oscuro (por defecto), Claro o Sistema. Se aplica al instante y se guarda en el perfil (ver `design-system.md` → Color).
- Aplicación: **Instalar en el dispositivo** (solo si la app no está instalada; con `beforeinstallprompt` abre el diálogo del navegador; en iOS abre el sheet "Instalar en el iPhone" con los pasos Compartir → "Agregar a inicio" → "Agregar") · versión (`0.1.0`).
- Cerrar sesión no pide confirmación.
- **Cerrar sesión**, separado del resto y en color de peligro.

### M12 · Alta / edición de blanco
- Sheet en mobile, diálogo en desktop. Acciones Cancelar / **Guardar blanco**; al editar, **Archivar blanco**.
- **Nombre*** · **Foto** (cámara / galería).
- **Puntuación**: *Anillos concéntricos* o *Sin zonas*.
- **Tamaño de referencia*** en mm (campo propio, arriba): diámetro de la zona exterior (anillos) o ancho del blanco (sin zonas). Acepta coma o punto decimal.
- Solo para anillos: **zonas de puntaje** (puntaje + diámetro en mm por fila, agregar y quitar; las etiquetas usan el número de fila: "Puntaje de la zona 2"), con "Cantidad de zonas" + **Generar** (reemplaza las filas por N anillos uniformes; el central vale N) y la **vista previa** dibujada al lado.
- Validación: puntajes y diámetros únicos, diámetros crecientes a medida que baja el puntaje (el error va en la fila que no crece) y ninguna zona más grande que el tamaño de referencia. Hasta 50 zonas.

### M13 / W08 · Visor de fotos
- Se abre al tocar una foto de contenido: la foto principal de la galería del arma (M09), las fotos del polígono (M03, W02) y las fotos elegidas en los formularios (`PhotoPicker`: arma, sesión, ronda, blanco; también las pendientes de subir). **No** se abre desde las miniaturas que son parte de un link (tarjeta de ronda, de blanco, de arma) ni desde el analizador (ahí tocar agrega impactos).
- Pantalla completa sobre fondo negro (no cambia con el tema; botones como los que van sobre fotos). Arriba: contador "2 / 3" y **Cerrar**. A los costados: **Foto anterior** / **Foto siguiente** (también en mobile; deshabilitadas en los extremos). Abajo a la derecha: **Acercar** / **Alejar**.
- Deslizar en horizontal (sin zoom) o las flechas del teclado cambian de foto; la foto nueva arranca entera. Zoom con dos dedos, doble toque (acerca 2,5× o vuelve), Ctrl + rueda o los botones, hasta 10×; con la foto ampliada, un dedo, el mouse o la rueda la desplazan.
- Sin ruta propia: la foto abierta va en el estado del historial, así "atrás" lo cierra y los formularios con cambios sin guardar no lo toman como salir. Escape y "Cerrar" vuelven atrás.
- `role="dialog"`, foco en "Cerrar" al abrir y de vuelta en la foto al cerrar. Si la flecha que tenía el foco se deshabilita, el foco vuelve al visor. Va arriba de los sheets y debajo de los toasts.

## Comportamiento PWA

- Manifest: `name: Range Book`, `theme_color: #0B0D0F`, `background_color: #0B0D0F`, `display: standalone`, orientación vertical e íconos con la diana del logo sobre naranja (192, 512, *maskable* y `apple-touch-icon`). El `theme-color` de la página sigue al tema.
- **Sin conexión:** banner "**Sin conexión** — los cambios se guardan y se sincronizan al volver" arriba del contenido (no fijo), en tono de advertencia con el ícono `wifi-off` (ver `maqueta/mobile/sesiones-sin-conexion.html`). Los formularios guardan igual (Firestore offline) y las fotos quedan en una cola en el dispositivo hasta que vuelve la conexión; mientras tanto se ven y se analizan.
- **Versión nueva:** toast "Hay una versión nueva" con la acción "Actualizar". Si no se acepta, se aplica al cerrar la app.
- Fotos: se comprimen en el cliente (lado mayor de 2000 px, JPEG al 80 %, sin EXIF) antes de subirlas a **Firebase Storage**. En Firestore se guarda la ruta. Las reglas de Storage restringen cada archivo a su dueño, igual que Firestore.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Fotos | Se guardan en Firebase Storage (agregado a `vision.md`) |
| Métricas | Sección 8 de `shooting_metrics.md`, más la distribución de puntaje de la sección 1 |
| Modelo del blanco | Tipo de puntuación, tamaño de referencia y zonas (en `requerimientos.md`) |
| Modelo de la ronda | Guarda el blanco usado y la distancia de tiro (en `requerimientos.md`) |
| Tema | Oscuro por defecto; el tema claro entra en el MVP. Selector Oscuro / Claro / Sistema en Perfil |
| Filtro de Rendimiento | Por configuración |
| Puntaje manual vs. calculado | El análisis propone el puntaje y el usuario lo confirma |
| Entidades del inventario en uso | Se archivan, no se borran |
| Personalizaciones en la sesión | Se guarda una copia (snapshot) al registrar la sesión |
| Regla de "toca la línea" | No aplica: el puntaje se calcula por el centro del impacto, sin el diámetro del proyectil |
| Fotos en ángulo (001) | Inclinación del blanco con perspectiva, no una elipse afín ([ADR 0006](../decisiones/0006-inclinacion-con-perspectiva.md)) |
| Gráficos (001) | Todos de línea, con el valor de cada punto; si no entran, se desplazan con el eje y fijo |
| Evolución de la sesión (001) | En una pestaña junto a las rondas; el PMI como desvío y como dispersión; mm o MOA a elección |
| Coordenadas del PMI (001) | Solo en el análisis, como "(x; y)" con signo |
| Fotos a pantalla completa (001) | Solo las fotos de contenido; las miniaturas que llevan a otra pantalla siguen navegando |
| Nombre de la app (001) | "Range Book", en la PWA y en toda la UI |

## Preguntas abiertas

No hay preguntas abiertas de diseño.
