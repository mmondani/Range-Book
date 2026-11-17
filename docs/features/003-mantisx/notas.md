# Notas — 003 MantisX

## Desvíos del plan

### Paso 0 — Hora de las rondas
- **`saveRawRound` recibe la hora de creación** como parámetro (`createdAt`, ISO en UTC): la pone el repositorio con `new Date().toISOString()`, así la función sigue siendo pura y se prueba sin reloj. La ronda nueva también nace con `mantis: null`.

### Paso 1 — Lectura del archivo
- **Archivo nuevo `src/lib/mantis.ts`** (no estaba en el plan): el modelo que se guarda (`RoundMantis`, `MantisTrace`), los límites (`MAX_MANTIS_SHOTS = 150`) y la lectura tolerante desde Firestore (`parseRoundMantis`, `parseMantisTrace`). `sessions.ts` lo necesita para parsear la ronda, y no correspondía que dependiera del lector del archivo (`mantis-import.ts`).
- **`sampleRate` va en el documento de la trayectoria, no por disparo,** como decía el plan: se toma el del primer disparo (en los 98 disparos de ejemplo es siempre 400).
- **Un dato inválido en cualquier sesión hace que falle el archivo entero** ("No se pudo leer el archivo"), en vez de saltear esa sesión. El archivo lo genera el marcador: si algo no tiene el formato esperado, lo más probable es que MantisX haya cambiado su API, y conviene enterarse.
- **El test del archivo de ejemplo completo** lo importa con `?raw` de Vite (el `tsconfig` de la app no tiene los tipos de Node para `fs`).

### Paso 2 — Diagnósticos y trayectoria
- **`formatFixed` y `formatTime`** se sumaron a `format.ts` (decimales fijos, "3,90"; hora local, "10:07"), y después `formatWeekdayDayMonth` ("Dom 15 nov"), `formatNumericDayMonth` ("31/10") y `formatDayMonthYear` ("15 nov 2026") para los textos de la revisión y de la ronda.
- **Extremos sin comparación:** con un solo disparo (o todos iguales) no se marca mejor/peor; con menos de dos splits, ni el más rápido ni el más lento.

### Paso 3 — Matching
- **Alineación por programación dinámica:** se asigna la mayor cantidad posible de sesiones de MantisX sin cruzar el orden y, entre esas, la de menor diferencia de hora total. Las rondas sin hora no suman diferencia, así que quedan por orden; ante un empate quedan sin usar las últimas rondas y las últimas sesiones de MantisX.
- **Afinidad del arma:** si hay varias sesiones el mismo día, gana la de la marca de MantisX (`make`) y, después, la que comparte números del modelo ("17 Gen5" y "G17").
- **Motivo nuevo para no importar: "Tiene más de 150 disparos."** Es el límite de las reglas para la trayectoria (y para que el resumen no agrande demasiado la sesión).
- **Los textos de la revisión también están en `mantis-matching.ts`** (`mantisSessionLabel`, `roundOptionLabel`, `skipReasonText`, `importedText`, `omittedNote`), para dejar la lógica fuera de los componentes.

### Paso 4 — Modelo y persistencia
- **`MantisTraceProvider` y `src/hooks/use-mantis.ts`** (no estaban en la lista de archivos): el contexto del repositorio de trayectorias, `useMantisTrace`, `useImportMantis` y `useRemoveMantis`. `App` recibe `mantisTraces` como los demás repositorios, y los helpers de test (`renderSessions`, `DataProviders`) lo inyectan.
- **`useUndoableRemove` se exportó y ahora recibe un `cleanup`** en vez de las rutas de las fotos: así lo usan también los datos de MantisX (la trayectoria se borra cuando ya no se puede deshacer). Las sesiones y las rondas siguen borrando sus fotos igual.
- **Los tests de reglas pasaron** (`pnpm test:rules`). Al terminar, el emulador de Firestore quedó corriendo (java en el puerto 8080) por un error del propio emulador al cerrarse.

### Paso 5 — Pantalla de importación
- **Componente nuevo `MantisExportHelp`** (los pasos y "Copiar el marcador"), con una versión `compact` para la columna lateral de desktop.
- **"Ya importadas" en desktop** se muestra con el mismo desplegable que en mobile, en vez de la frase de la maqueta ("Ya importadas: 8 (sesión del 25/10)").
- **Las rondas elegidas en otra fila no aparecen** en las opciones (como pide la maqueta). Para pasar una ronda de una fila a otra, primero se libera en la fila que la tiene. `assignRound` igual saca la ronda de la otra fila si se repite.

### Paso 6 — Ver los datos en la ronda
- **Componente nuevo `MantisShotTrace`**: el cuadro (`MantisTrace`), la leyenda, la nota de la distancia y la reproducción, juntos. `MantisTrace` queda como el SVG puro.
- **Los trazos usan `vector-effect: non-scaling-stroke`** en vez de escalar el grosor a mano como la maqueta.
- **`useTracePlayback` recibe una clave del disparo** (`traceKey`): al cambiar de disparo se detiene y muestra la trayectoria completa, sin tener que remontar el componente.
- **Velocidad "Lenta" a 1/10** (la maqueta decía ¼): pedido después del primer deploy, a ¼ un disparo duraba unos 3 s y no se llegaba a ver. Ahora dura unos 7,6 s.
- **Acceso a MantisX desde el análisis de la ronda** (pedido después del primer deploy): la misma píldora `MantisPill` debajo del subtítulo del análisis, si la ronda tiene datos de MantisX. Si el análisis tiene cambios sin guardar, salir pide confirmación como siempre.
- **Los tests con el reloj simulado usan `fireEvent`:** `userEvent` se cuelga con `vi.useFakeTimers()` completo en este proyecto.

### Paso 8 — Cierre
- **`spike/` se borró:** el marcador está en `src/lib/mantis-bookmarklet.ts` (con test de que es JavaScript válido y escribe el formato que lee la app).
- **ADR 0009** ("Datos de MantisX por bookmarklet e importación de archivo").

## Desvíos respecto de la maqueta aprobada
- **Velocidad "Lenta" a 1/10** (la maqueta decía ¼).
- **Acceso a MantisX desde el análisis** de la ronda (no estaba en la maqueta): la misma `MantisPill` debajo del subtítulo. En la maqueta general se agregó en `web/analisis.html`; en `mobile/analisis.html` no, porque su encabezado es de alto fijo y habría que rehacer el layout de la página.
- **"Ya importadas" en desktop** es un desplegable, como en mobile, en vez de la frase de la maqueta.
- **Motivo "Tiene más de 150 disparos."** en "No se importan" (no estaba en la maqueta).

## Criterios de aceptación
| Criterio | Cómo se verificó |
|---|---|
| Importar desde Sesiones un archivo exportado de MantisX | `mantis-import.test.ts` (fixture, archivo real e inválidos), `mantis-import-screen.test.tsx` y prueba en `range-book.web.app` |
| Proponer el matching sesión ↔ sesión y ronda ↔ sesión de MantisX, por la hora | `mantis-matching.test.ts`, test de pantalla y prueba manual |
| Editar el matching | `mantis-matching.test.ts`, test de pantalla y prueba manual |
| Guardar lo importado en Firestore | tests de las rondas crudas y de la persistencia (`rounds.test.ts`, `mantis.test.ts`), `pnpm test:rules` y prueba en producción |
| Datos de cada disparo y de cada sesión de MantisX | tests de normalización y de lectura de Firestore |
| Valores calculados (tiempo total, promedio, trayectoria relativa, extremos) | `mantis-trace.test.ts`, `mantis-round-screen.test.tsx` y prueba manual |
| Ver la información de MantisX de cada disparo de la ronda | `mantis-round-screen.test.tsx` (también desde el análisis) y prueba manual |

## Pendientes
- **Confirmar contra la app de MantisX** la convención de `angle` (0° = derecha, antihorario) y los signos de `yaw` y de `absolute_roll`; hasta entonces la inclinación se muestra sin lado.
- **Rendimiento y Evolución no usan MantisX** (fuera de alcance de esta iteración).
- **Trayectorias huérfanas** de rondas o sesiones eliminadas: se aceptan (ADR 0009).
- Solo se importa fuego real de "Open Training": tiro en seco y otros entrenamientos quedan para más adelante.

## Aprendizajes
- **Con `vi.useFakeTimers()` completo, `userEvent` se cuelga** en este proyecto (también con `delay: null`): los tests con reloj simulado usan `fireEvent` dentro de `act` y `getBy*` en vez de `findBy*`.
- **El emulador de Firestore puede quedar corriendo** después de `pnpm test:rules` (error de java al cerrarse) y ocupar el puerto 8080: hay que cerrarlo a mano.
- **Los ángulos de un sensor se pasan a mm a la distancia de la ronda** con `tan(θ) · d`; a 5,5 m, 0,1° son ~9,6 mm, así que la escala del cuadro tiene que ser automática.
