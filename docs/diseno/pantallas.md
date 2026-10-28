# Pantallas — RangeBook

**Estado:** Borrador para revisión
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
| `/sesiones/:id/rondas/nueva`, `…/rondas/:rid/editar` | M05 (sheet sobre M03) | diálogo | `mobile/ronda-form.html` |
| `/sesiones/:id/rondas/:rid/analisis` | M06 (calibración y análisis) | W04 | `mobile/analisis-calibracion.html`, `mobile/analisis.html`, `web/analisis-calibracion.html`, `web/analisis.html` |
| `/rendimiento` (filtros en la query string) | M07 | W05 | `mobile/rendimiento.html`, `web/rendimiento.html` |
| `/inventario/:categoria` (`armas`, `configuraciones`, `municiones`, `poligonos`, `blancos`) | M08 | W06 | `mobile/inventario.html`, `web/inventario.html` |
| `/inventario/armas/nueva`, `/inventario/armas/:id/editar` | M10 | diálogo / página | `mobile/arma-form.html` |
| `/inventario/armas/:id` | M09 | W07 | `mobile/arma-detalle.html`, `web/arma-detalle.html` |
| `/inventario/blancos/nuevo`, `/inventario/blancos/:id/editar` | M12 | diálogo | `mobile/blanco-form.html` |
| `/perfil` | M11 | columna de 640 px | `mobile/perfil.html` |

- Todas las rutas, menos `/login`, requieren sesión **y** que el email esté en la colección de autorizados.
- Los sheets y diálogos tienen su propia URL, así el botón "atrás" del sistema los cierra.
- Al volver a una lista se conservan el scroll y los filtros.

## Pantallas

### M01 / W01 · Login
- Logo, nombre y propuesta de valor. Una sola acción: **Continuar con Google** (botón blanco, según la guía de marca de Google).
- **Estados:** inicial · cargando (botón con spinner) · **no autorizado** (alerta roja con el email usado y el texto "probá con otra cuenta o pedí acceso"; se muestra en W01) · error de red (alerta con "Reintentar").
- Si el usuario autenticado no está autorizado, se cierra la sesión de Firebase y se muestra la alerta.

### M02 · Sesiones (inicio) / W02 · Sesiones lista + detalle
- Header: título, buscar y filtrar.
- Resumen del mes: sesiones, disparos y promedio por tiro.
- Lista agrupada por mes con `SessionCard`. La sesión de hoy se destaca.
- Mobile: FAB **Nueva sesión**. Desktop: botón primario en el sidebar; búsqueda y chips de arma arriba de la lista; detalle de la sesión seleccionada a la derecha, con la tabla de rondas (foto, ronda y blanco, distancia, disparos, puntaje, grupo, comentarios, estado del análisis y acciones "Ver análisis" / "Analizar blanco" y editar). Un clic en cualquier parte de la fila (salvo sus links y botones) lleva al análisis; la fila se resalta al pasar el mouse.
- **Estados:** vacío ("Todavía no registraste sesiones" + Nueva sesión) · cargando (skeletons) · sin resultados de búsqueda.

### M03 · Detalle de sesión
- Galería de fotos del polígono arriba, con volver, editar y menú (eliminar).
- Fecha, configuración (título) y chips de personalizaciones.
- Datos: polígono, clima, munición.
- Totales: disparos, puntaje (obtenido / máximo) y tamaño de grupo promedio de las rondas analizadas.
- **Rondas:** `RoundRow` con miniatura (la foto de la ronda o el dibujo del blanco), "disparos · puntaje · grupo", "blanco · **distancia** · comentarios", estado *Analizada* o *Sin analizar* y el link "Ver análisis" / "Analizar blanco". **Toda la tarjeta lleva al análisis**; el lápiz "Editar ronda N" abre M05.
- Notas.
- Barra fija: **Agregar ronda**.
- Eliminar la sesión pide confirmación y ofrece "Deshacer" en un toast.

### M04 / W03 · Nueva / editar sesión
- Campos: **Arma / configuración*** (select con armas base y configuraciones) · **Personalizaciones** (chips precargados desde la configuración; se pueden quitar y agregar) · **Fecha*** (hoy por defecto) · **Polígono*** (el último usado por defecto) · **Clima** (radio con chips: Soleado, Nublado, Lluvioso, Niebla, Ventoso) · **Munición*** (la última usada con esa arma) · **Fotos del polígono** (cámara / galería, varias) · **Notas**.
- Al guardar, la sesión copia las personalizaciones elegidas (**snapshot**: marca y modelo de cada modificación). Si después se edita o archiva la configuración o una modificación, el historial de la sesión no cambia.
- Las rondas **no** se cargan acá: se agregan desde el detalle, a medida que se tira. Así la sesión se crea en segundos al llegar al polígono.
- Validación al salir del campo. Al guardar con errores, foco en el primer campo inválido.
- Cerrar con cambios sin guardar pide confirmación. Guardar borrador local (autosave).

### M05 · Agregar ronda (sheet)
- Campos: **Blanco*** (del ABM; el último usado por defecto) · **Distancia*** en metros (se precarga con la de la ronda anterior) · **Disparos*** (stepper; por defecto, el valor de la ronda anterior) · **Puntaje** (numérico) · **Foto del blanco** (cámara / galería) · **Comentarios**.
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
- **Qué ajustar** (botones sobre la foto, arriba a la izquierda): Centro / Anillo / **Forma** (o Centro / Punto A / Punto B). El activo se ve con borde verde; los ya ubicados llevan ✓. Al ubicar un punto pasa solo al siguiente que falte.
- **Centro automático:** en un blanco con anillos, al cargar la foto se busca el centro y queda ubicado ("Buscando el centro…" sobre la foto); el activo pasa a "Anillo" y el panel avisa: "El centro se ubicó automáticamente. Si no coincide con el de la foto, elegí «Centro» y tocalo." Si no hay un centro claro, se toca a mano.
- Cada punto se ubica tocando la foto o **manteniendo apretado y arrastrando**: el marcador sigue al dedo y los anillos verdes se redibujan en vivo. Con el dedo, el arrastre empieza a los 100 ms: si antes se apoya un segundo dedo, el gesto es un zoom y el marcador no se mueve.
- **Forma** (foto en ángulo): mantener apretado y arrastrar estira o achica los anillos verdes hasta el dedo en esa dirección, conservando la medida perpendicular; se repite en otras direcciones hasta que coincidan. "Volver a círculos" lo deshace. Las medidas siguen a la elipse (puntaje, grupo, PMI y distancias quedan compensados). Compensa ángulos moderados, no la perspectiva fuerte.
- Panel "Calibrar la foto": la explicación, la instrucción del punto activo, el aviso del centro automático, "Volver a círculos", el select **Anillo marcado** ("8 puntos · Ø 150 mm"; por defecto, el tercero desde el centro) o el campo **Distancia entre A y B** (por defecto, el tamaño de referencia del blanco) y el error si falta algo.
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
| **PMI** (*Mean Point of Impact*) | Promedio de las coordenadas de los impactos | Cruz sobre la foto + desvío del centro en mm y dirección en horas de reloj |
| **Distancia al centro** (*Distance from Center*) | Promedio de la distancia de cada impacto al centro del blanco | mm |

- La implementación va en `src/lib/` (funciones puras con tests). `maqueta/assets/analyzer.js` sirve de referencia de cálculo y de interacción.
- El radio medio del prototipo anterior se quitó porque no está en el alcance que define `shooting_metrics.md`.
- **Fuera del MVP** (sección 8, "Then add"): heatmaps, CEP, tendencias por impacto. También desvío estándar, detección de *flyers* y orden de los disparos. El modelo de impactos en mm ya los permite más adelante.

### M07 / W05 · Rendimiento
- Filtros: **configuración** (cada arma virtual por separado; el arma base sin modificaciones es su propia configuración "Stock"), munición, blanco, **distancia**, polígono y período. En mobile son chips que abren un sheet; en desktop, selects.
- KPIs: promedio por tiro, tamaño de grupo, desvío del PMI y disparos. Cada uno con su delta contra el período anterior.
- Gráficos: puntaje promedio por sesión (línea) y tamaño de grupo por sesión (barras, "menor es mejor"). Mezclar distancias distorsiona el tamaño de grupo en mm: por defecto se filtra por la distancia más usada (o se compara en MOA).
- Mobile: comparación por munición (barras horizontales). Desktop: tabla por sesión, ordenable, con distancia y "Exportar CSV".
- **Estados:** sin análisis todavía (EmptyState: "Analizá tus blancos para ver la evolución") · pocos datos (menos de 2 sesiones: solo KPIs).

### M08 / W06 · Inventario
- Categorías: **Armas · Configuraciones · Munición · Polígonos · Blancos**, con su contador. En mobile son chips; en desktop, tabs.
- El botón primario cambia según la categoría ("Nueva arma", "Nueva configuración", …).
- Armas: tarjeta con foto, marca y modelo, calibre, cantidad de modificaciones y tiros acumulados.
- Configuraciones: nombre, arma base, modificaciones y sesiones.
- Munición (marca, modelo, descripción) y Polígonos (nombre, dirección): listas o tablas con acciones. **Alta y edición en sheet o diálogo** (formularios cortos, mismo patrón que M05).
- Blancos: foto, nombre y resumen de la geometría ("Anillos · Ø 500 mm · 10 zonas" o "Sin zonas · puntaje manual"). Alta y edición en M12.
- **Archivar en lugar de borrar:** armas, modificaciones, configuraciones, municiones, polígonos y blancos no se borran, se archivan. Un elemento archivado no aparece en los selects de sesión y ronda ni en las listas, pero sigue visible en el historial y en Rendimiento. Se ve con "Mostrar archivados" (web) o "Ver archivadas" (mobile), y desde ahí se puede restaurar.
- Las sesiones y las rondas sí se eliminan (con confirmación y "Deshacer"), porque nada las referencia.

### M09 / W07 · Detalle de arma
- Galería (portada y miniaturas, agregar foto), marca y modelo, calibre.
- **Tiros acumulados** = tiros previos al registro + suma de los disparos de las sesiones.
- Datos de compra.
- **Modificaciones**: lista con marca, modelo y comentarios. Alta, edición y archivo en sheet.
- Acción **Archivar** para el arma (no hay borrado).
- **Configuraciones** (armas virtuales): nombre, modificaciones incluidas y sesiones. "Nueva configuración" abre un sheet con el nombre y checkboxes de las modificaciones del arma.

### M10 · Alta / edición de arma
- Fotos (varias; la primera es la portada) · **Marca*** · **Modelo*** · **Calibre*** (con sugerencias) · Fecha de compra · Lugar de compra · Tiros previos al registro.
- La maqueta muestra un error de validación en "Modelo" como ejemplo del patrón.

### M11 · Perfil
- Avatar (foto de Google), nombre, email y resumen (sesiones, disparos, armas).
- Preferencias: **unidades** (mm / pulgadas) · **tema**: Oscuro (por defecto), Claro o Sistema. Se aplica al instante y se guarda en el perfil (ver `design-system.md` → Color).
- Aplicación: **Instalar en el dispositivo** (aparece solo si llega `beforeinstallprompt`; en iOS, instrucciones para "Agregar a inicio") · versión.
- **Cerrar sesión**, separado del resto y en color de peligro.

### M12 · Alta / edición de blanco
- **Nombre*** · **Foto** (cámara / galería).
- **Puntuación**: *Anillos concéntricos* o *Sin zonas*.
- **Tamaño de referencia*** en mm: diámetro de la zona exterior (anillos) o ancho del blanco (sin zonas).
- Solo para anillos: **zonas de puntaje** (puntaje + diámetro en mm por fila, agregar y quitar), con **Generar** para crear N anillos uniformes a partir del diámetro, y **vista previa** dibujada.
- Validación: diámetros únicos y crecientes a medida que baja el puntaje; ninguna zona más grande que el tamaño de referencia.

## Comportamiento PWA

- Manifest: `name: RangeBook`, `theme_color: #0B0D0F`, `background_color: #0B0D0F`, `display: standalone` e íconos con la diana naranja.
- Sin conexión: banner "Sin conexión — los cambios se guardan y se sincronizan al volver" (persistencia offline de Firestore). Las fotos pendientes de subir a Storage quedan en una cola.
- Fotos: comprimir en el cliente antes de subirlas a **Firebase Storage** (por ejemplo, lado mayor de 2000 px y JPEG/WebP al 80 %). En Firestore se guarda la ruta en Storage. Las reglas de Storage restringen cada archivo a su dueño, igual que Firestore.

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

## Preguntas abiertas

No hay preguntas abiertas de diseño.
