# Sistema de diseño — Range Book

**Estado:** Implementado hasta la iteración 001 (Fixes)
**Maqueta:** [`maqueta/index.html`](./maqueta/index.html)
**Fuente de verdad:** este documento. Si la maqueta y este documento difieren, prevalece este documento.

## Dirección visual

- **Estilo:** utilitario y por bloques, oscuro por defecto. Inspirado en instrumentos y equipamiento de tiro: superficies grafito, un único acento naranja de seguridad (*blaze orange*) y números grandes en tipografía condensada.
- **Por qué oscuro por defecto:** la app se usa en el polígono, con la pantalla en la mano entre ronda y ronda. Un fondo oscuro con alto contraste y números grandes se lee rápido. El **tema claro** también entra en el MVP (por ejemplo, para usarla a pleno sol) y se elige en Perfil.
- **Prioridad:** primero el celular (PWA). En desktop se reorganiza el mismo contenido en más columnas.
- **Evitar:** degradados decorativos, emojis como íconos, tarjetas con borde lateral de color y sombras fuertes. Cada pantalla tiene **una sola** acción primaria (naranja).

## Tokens

Definirlos como variables CSS en `src/styles/tokens.css`. Los componentes usan solo tokens, nunca hex sueltos.

### Color

Dos temas con los mismos tokens: **oscuro (por defecto)** y **claro**. El usuario elige Oscuro, Claro o Sistema en Perfil.

- **Aplicación:** atributo `data-theme="dark" | "light"` en `<html>`, resuelto antes del primer render para evitar el parpadeo. Para "Sistema" se usa `prefers-color-scheme` y se escuchan sus cambios.
- **Persistencia:** la preferencia se guarda en el perfil del usuario (Firestore) y en `localStorage`, para aplicarla al instante al abrir la PWA.
- **Meta tag:** `theme-color` del navegador = `--bg` del tema activo.

| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| `--bg` | `#0B0D0F` | `#F6F7F8` | Fondo de la app |
| `--sunken` | `#0E1114` | `#EEF0F2` | Sidebar, panel de marca del login |
| `--surface` | `#14181C` | `#FFFFFF` | Tarjetas, barra inferior, sheets |
| `--surface-2` | `#1C2126` | `#EEF0F2` | Inputs, botón secundario, chips sobre tarjetas |
| `--surface-3` | `#262C33` | `#E2E5E9` | Segmento activo, hover fuerte, grilla de gráficos |
| `--ph-2` | `#20262C` | `#E6E9EC` | Segunda franja de los placeholders de foto |
| `--border` | `#2E353D` | `#D5DAE0` | Bordes y divisores |
| `--border-strong` | `#3E4650` | `#AEB6BF` | Borde en hover de tarjetas |
| `--axis` | `#3A424B` | `#AEB6BF` | Línea base de los gráficos |
| `--text` | `#F2F4F5` | `#14181C` | Texto principal |
| `--text-2` | `#B4BCC5` | `#444C55` | Texto secundario |
| `--text-3` | `#8A949F` | `#5E6772` | Etiquetas, ayudas, ejes (≥4.5:1 sobre `--surface` y `--surface-2`) |
| `--accent` | `#FF6A1A` | `#B93D0B` | Acción primaria, selección, impactos, dato destacado |
| `--accent-hover` | `#FF7F3A` | `#9F340A` | Hover del primario y de los links |
| `--accent-soft` | `rgba(255,106,26,.14)` | `rgba(185,61,11,.10)` | Fondo de chip o ítem seleccionado |
| `--on-accent` | `#1A0B02` | `#FFFFFF` | Texto sobre el acento |
| `--success` | `#3DD68C` | `#157042` | "Analizada", deltas positivos |
| `--warning` | `#F5C04A` | `#8A5A00` | "Sin analizar", desajuste de impactos, sol |
| `--danger` | `#FF6B6B` | `#B42318` | Errores, cerrar sesión, eliminar sesión |
| `--info` | `#5AA9FF` | `#1F6FD1` | PMI, serie secundaria de gráficos |
| `--paper` | `#E9E4D6` | `#E9E4D6` | Fondo de los blancos dibujados (simula la foto; no cambia con el tema) |
| `--scheme` | `dark` | `light` | Valor de `color-scheme` (controles nativos: date picker, scrollbars) |

Reglas:
- **Fondos de estado:** derivarlos del token con `color-mix(in srgb, var(--success) 14%, transparent)`, nunca con un `rgba` fijo. Así funcionan en los dos temas.
- **Lo que no cambia con el tema:** la foto del blanco y sus superposiciones, con colores fijos: impactos `#FF6A1A` (en el modo Quitar, `#FF6B6B`), PMI `#5AA9FF`, grupo punteado `#FF6A1A` y calibración (anillos calibrados, marcadores, punto activo) `#3DD68C`. También los botones sobre fotos (fondo `rgba(11,13,15,.75)`, borde `rgba(255,255,255,.25)`, texto `#F2F4F5`).
- **Color como indicador:** nunca es el único. Los estados llevan siempre texto o ícono (por ejemplo, el badge "Analizada" con ✓).
- **Gráficos:** naranja y azul se distinguen también por luminosidad. No usar pares rojo/verde.
- **Contraste:** verificar cada tema por separado. Los valores claros de acento y de estado son más oscuros que los del tema oscuro justamente para llegar a 4.5:1 sobre blanco.

### Tipografía

| Rol | Fuente | Tamaño / peso | Notas |
|---|---|---|---|
| Display (títulos, números grandes) | **Barlow Condensed** 700 | 22 / 26 / 32 / 40 / 56 px | MAYÚSCULAS, `line-height:1.05` |
| Cuerpo | **Barlow** 400–600 | 16 px base (mín. 14 px en secundarios) | `line-height:1.5` |
| Eyebrow / etiquetas de datos | Barlow 600 | 13 px, `letter-spacing:.08em`, mayúsculas | color `--text-3` |
| Navegación inferior | Barlow 600 | 12 px | único uso de 12 px |

- Todos los números llevan `font-variant-numeric: tabular-nums` (clase `.num`).
- Formato de números en `es-AR`: separador de miles `.` y decimal `,` (`Intl.NumberFormat('es-AR')`).
- Carga: Google Fonts con `display=swap`. El service worker las guarda en caché, así se ven también sin conexión.

### Espaciado, radios y elevación

- Escala de 4 pt: `4 8 12 16 20 24 32 40 48`.
- Margen lateral: 16 px en mobile; 32–40 px en desktop.
- Radios: inputs y botones `12px`, tarjetas `16px`, sheets `24px` (arriba), chips `999px`, miniaturas `8–10px`.
- Elevación: casi plana. Las tarjetas se separan con borde, no con sombra. Solo el FAB y los sheets llevan sombra (`0 8px 24px rgba(0,0,0,.5)`).
- Capas (z-index): contenido 0, header fijo 10, barra inferior 20, FAB 30, scrim y sheet 40, visor de fotos 45, toast 50.

### Movimiento

- Duraciones: 120 ms al presionar, 200 ms para cambios de estado, 280 ms al entrar un sheet o diálogo (y 180 ms al salir).
- Easing: `cubic-bezier(.2,.8,.2,1)` al entrar y `cubic-bezier(.4,0,1,1)` al salir.
- Respetar `prefers-reduced-motion`: sin desplazamientos, solo fundidos.

## Íconos

- Set: **Lucide** (`lucide-react`), trazo 2 px y 24 px (18 px en chips y botones chicos). Es el set que se dibujó en la maqueta.
- Mapeo: Sesiones `Crosshair`, Rendimiento `TrendingUp`, Inventario `Package`, Perfil `User`, Cámara `Camera`, Galería `Image`, Modificación `Wrench`, Configuración `Layers`, Detectar `WandSparkles`, Agregar impacto `CirclePlus`, Quitar impacto `CircleMinus`, Deshacer `Undo2`, Recalibrar la foto `Crosshair`, Acercar `ZoomIn`, Alejar `ZoomOut`, Ver la foto entera `Maximize2`, Editar `Pencil`, Polígono `MapPin`, Eliminar `Trash2`, Sin conexión `WifiOff`, Instalar `Download`, Compartir (iOS) `Share`, Versión `Info`, Cerrar sesión `LogOut`, Cerrar el visor `X`, Foto anterior `ChevronLeft`, Foto siguiente `ChevronRight`. Clima: `Sun`, `Cloud`, `CloudRain`, `CloudFog`, `Wind`.
- Un ícono decorativo junto a un texto lleva `aria-hidden`. Un botón que solo tiene ícono lleva `aria-label`.
- Logo provisorio: diana con cruz dentro de un cuadrado redondeado naranja (se ve en Login y en el sidebar). Es también el ícono de la PWA y el favicon (`public/icons/`, generados con `scripts/generate-icons.ps1`).

## Layout responsive

| Ancho | Navegación | Layout |
|---|---|---|
| < 1024 px | **Barra inferior** de 4 ítems (Sesiones, Rendimiento, Inventario, Perfil), con ícono y texto | Una columna. Header propio de cada pantalla. FAB "Nueva sesión" en la lista |
| ≥ 1024 px | **Sidebar** de 240 px con logo, botón primario "Nueva sesión", los 4 ítems y el usuario abajo | Contenido fluido con `max-width` por pantalla. Sesiones usa lista y detalle a la vez |

- Usar `min-h-dvh`, nunca `100vh`. Respetar `env(safe-area-inset-*)` en el header, la barra inferior y las barras de acción fijas.
- El contenido que scrollea deja espacio libre para la barra inferior (80 px + safe area) y para la barra de acción fija (88 px).
- Sin scroll horizontal de página. Las tablas anchas van dentro de un contenedor con `overflow-x:auto`.

## Componentes

| Componente | Variantes / estados | Notas |
|---|---|---|
| `Button` | `primary`, `secondary`, `ghost`, `danger`; `md` (44 px) y `lg` (48–52 px); `loading`, `disabled` | `loading` desactiva el botón y muestra un spinner. `disabled` usa opacidad .45 |
| `IconButton` | 40–44 px; sobre foto con fondo `rgba(11,13,15,.75)` | `aria-label` obligatorio. Los botones de zoom del visor son redondos, de 40 px |
| `LinkButton`, `IconLink`, `CardLink` | Links con el aspecto de `Button`, `IconButton` y `Card` | Para navegar se usa un link, no un botón |
| `Fab` | Extendido (ícono + texto), 56 px | Solo en la lista de sesiones (mobile) |
| `Chip` | `filter` (con caret), `selectable` (`.on`), `removable` (con ✕ de 32 px), `add` (borde punteado) | Los grupos de chips se acomodan en varias líneas, sin scroll horizontal |
| `Badge` | `success`, `warning`, `accent`, `neutral` | Con texto siempre. Estados: "Hoy", "Archivado", *Analizada* / *Sin analizar* (`RoundStatus`) |
| `Tag`, `TagList` | Etiqueta chica (calibre, modificaciones) | Sin interacción |
| `Avatar` | Foto de Google o iniciales | Si la foto no carga, iniciales |
| `Alert` | `danger`, `warning`; título, texto y acción opcional | `role="alert"`. Login no autorizado, error de red, detección fallida, borrador recuperado |
| `OfflineBanner` | Tono de advertencia, compacto: ícono `WifiOff` + "**Sin conexión** — los cambios se guardan y se sincronizan al volver" | Arriba del contenido de todas las pantallas mientras no hay conexión; `role="status"` |
| `Card` | Base y `interactive` (hover en el borde) | La tarjeta clickeable es un `<a>`; si además tiene otra acción (por ejemplo, editar), su link principal se estira sobre ella (`::after`) y la otra acción queda por encima |
| `StatTile` | Eyebrow + número display + unidad + delta o ayuda; tamaños `md` y `sm` (26 px, para tres por fila en mobile) | Usado en totales de sesión, KPIs y métricas |
| `Field` | Label + control + ayuda + error | Asterisco naranja si es obligatorio. El error va debajo del campo, con `aria-describedby` y `role="alert"` |
| `Input`, `Select`, `Textarea`, `DateInput` | Alto 48 px en mobile y 44 px en desktop | Controles nativos (`type="date"`, `inputmode="numeric"`, `datalist` para calibre) |
| `Stepper` | − valor + | Para cantidad de disparos |
| `SegmentedControl` | 2–3 opciones | Unidades, tema |
| `Tabs` | Mobile: chips seleccionables; desktop: tabs subrayados | Inventario y el detalle de sesión (Rondas / Evolución). El contador va separado por un espacio, para el nombre accesible |
| `WeatherPicker` | Chips de clima con ícono; tocar el elegido lo desmarca | M04 |
| `ModificationPicker`, `ModificationChecklist` | Chips de personalizaciones con quitar y "Agregar" (despliega las que faltan); checkboxes de modificaciones | M04 y sheet de configuración |
| `ZoneEditor` | Filas puntaje + diámetro, Generar anillos uniformes, vista previa | Alta de blanco (M12) |
| `PhotoPicker` | Botones Cámara / Galería, miniaturas con quitar, portada | Cámara: `<input type=file accept=image/* capture=environment>`. Galería: igual pero sin `capture`. En desktop, zona para arrastrar archivos |
| `PhotoGallery` | Imagen principal + miniaturas, contador "1 / 3" | Imágenes con `aspect-ratio` reservado |
| `PhotoStrip` | Fotos a todo el ancho que se deslizan de a una, con "1 / 3 fotos" y botones encima | Encabezado de M03 en mobile |
| `Photo` | Foto guardada o pendiente de subir; placeholder rayado mientras carga e ícono si falla | Base de las anteriores. En `PhotoGallery` (foto principal), `PhotoStrip` y `PhotoPicker` va dentro de un `PhotoButton` |
| `BottomSheet` / `Dialog` | Sheet en mobile y diálogo centrado en desktop (un solo componente, resuelto con CSS) | Agarrador, botón cerrar, scrim .7. Pide confirmación si hay cambios sin guardar. Las acciones del pie reciben `requestClose`, así "Cancelar" también confirma |
| `InventorySheet`, `FilterSheet` | Sheet de alta y edición del inventario (con "Archivar …" o "Eliminar …"); opciones de un filtro de Rendimiento como chips | — |
| `ConfirmDialog` | Destructivo | Para eliminar cualquier entidad |
| `Toast` | Éxito o error, con una acción opcional ("Deshacer", "Actualizar") | `aria-live="polite"`, se cierra solo a los 4 s. Uno a la vez |
| `EmptyState` | Ícono + texto + acción | Para listas vacías y gráficos sin datos |
| `Skeleton` | Tarjetas, filas, gráficos | Si la carga tarda más de 300 ms |
| `SessionCard` | Fecha en bloque, configuración, polígono · munición, clima, rondas / disparos / promedio | Variante "Hoy" con borde y badge de acento. En W02 es una fila compacta |
| `FirearmCards`, `ConfigurationCard`, `TargetCards`, `InventoryItems` | Tarjetas de armas, configuraciones y blancos; lista (mobile) o tabla (desktop) del inventario, con sus estados (cargando, error, vacío, sin resultados, todo archivado) y archivados atenuados con "Restaurar" | — |
| `RoundRow` | Miniatura del blanco, ronda, disparos · puntaje · grupo, blanco · distancia · comentarios, estado de análisis, link "Ver análisis" / "Analizar blanco" y lápiz "Editar" | Toda la tarjeta lleva al análisis. En desktop es una fila de tabla (`RoundTable`), que también lleva al análisis con un clic |
| `TargetThumb` | Foto del blanco o dibujo de sus anillos (silueta de cartón para los blancos sin zonas) | — |
| `TargetAnalyzer` | Visor de la foto: recuadro 5:6 (mobile) o 1:1 (desktop), la foto arranca cubriéndolo y centrada; zoom propio (botones Acercar / Alejar / Ver la foto entera abajo a la derecha, dos dedos, Ctrl + rueda) y desplazamiento; controles propios arriba a la izquierda (`controls`); impactos (anillo naranja de 2 px sin relleno, 18 px en mobile y 20 px en desktop, con un filo oscuro de cada lado; rojo en Quitar), PMI (cruz azul), grupo (punteado naranja), anillos de calibración y marcadores (verde); overlay de progreso | Marcadores y trazos mantienen su tamaño con cualquier zoom. Arrastre de marcadores con los punteros (con el dedo, a los 100 ms; un segundo dedo es zoom). Ver `pantallas.md` → Análisis |
| `MarkerPicker` | Botones sobre la foto (40 px, redondeados): Centro / Anillo / Inclinación o Centro / Punto A / Punto B; activo con borde verde, ✓ en los ya ubicados | `radiogroup` "Qué ajustar", navegable con las flechas |
| `CalibrationPanel` | Tarjeta "Calibrar la foto": explicación, instrucción del punto activo, aviso del centro automático, la inclinación ("Inclinación: 30° hacia abajo"), aviso de la forma vieja, "Quitar la inclinación", anillo marcado o distancia A–B, error | — |
| `AnalyzerToolbar` | Detectar / Agregar / Quitar (`aria-pressed`); "Detectar automáticamente" en desktop | `toolbar` "Modo de edición" |
| `ScoreTile` | Puntaje / máximo, promedio por tiro y distribución por zona; lugar para la confirmación del puntaje | — |
| `MetricTile` | Tamaño de grupo (mm + MOA), desvío del PMI (hora de reloj o "Centrado", y debajo sus coordenadas "(x; y)" con signo, en 13 px), distancia al centro | Una `StatTile` en tarjeta. Unidad en mm o pulgadas, según el perfil |
| `ImpactTable` | #, zona, X / Y desde el centro, quitar | Solo en desktop; alternativa accesible para quitar impactos |
| `LineChart` | Valor sobre cada punto (12 px; el destacado, 14 px), el último destacado (o el que se toca o se señala) con su etiqueta del eje x resaltada; etiquetas del eje x que no se pisan; `aria-label` con el resumen | Grilla tenue. Dibuja en px reales: cada punto ocupa al menos 52 px y, si no entran, el área se desplaza en horizontal (enfocable con el teclado) con el eje y fijo (`ChartYAxis`). Etiquetas del eje x: fechas ("2 ago") o rondas ("R1"). Es el único gráfico por sesión o ronda (no hay barras) |
| `MpiScatter` | Dispersión de los PMI de cada ronda alrededor del centro: ejes, dos círculos de referencia con su medida, puntos `--info` numerados (el número en `--surface`), recorrido punteado, la última resaltada | Evolución de la sesión. Hasta 280 px de ancho |
| `SessionEvolution` | Nota "Por ronda analizada · N de M", control mm | MOA, control PMI / Grupo / Al centro, gráficos y estados | Pestaña Evolución de M03 / W02 |
| `PhotoViewer` | Visor a pantalla completa: contador, Cerrar, anterior / siguiente, Acercar / Alejar; deslizar, dos dedos, doble toque, Ctrl + rueda | Fondo negro y botones de "sobre la foto" (no cambia con el tema). Capa entre sheet (40) y toast (50) |
| `PhotoButton` | Foto que se toca para verla a pantalla completa; cursor `zoom-in` | Nombre "Ver la foto N de M en pantalla completa"; la foto conserva su texto alternativo |
| `DataTable` | Ordenable (`aria-sort`, botón en el encabezado), columnas `numeric` (a la derecha, cifras tabulares), scroll horizontal en su contenedor; filas clickeables (`onRowClick`, con resaltado al pasar el mouse) | Rendimiento, inventario, rondas, impactos. La fila clickeable es un atajo para el mouse: la misma acción tiene que estar en un link o botón de la fila |
| `AmmunitionComparison` | Barras horizontales por munición; la mejor ocupa todo el ancho | Rendimiento en mobile |

## Accesibilidad (mínimos)

- Contraste del texto ≥ 4.5:1 en todos los pares de tokens de arriba, en los dos temas (verificado: el texto de acento y de estado sobre su fondo tintado también cumple).
- Áreas táctiles ≥ 44×44 px, con ≥ 8 px entre una y otra.
- Foco visible: `outline: 2px solid var(--accent); outline-offset: 2px`.
- Jerarquía de headings sin saltos. Cada ruta mueve el foco al `<h1>`.
- Todo lo que se hace con gestos tiene un control visible. En el analizador, quitar un impacto también se puede hacer desde la tabla de impactos, el zoom tiene botones y el punto a ubicar se elige con botones sobre la foto. En el visor de fotos, deslizar tiene las flechas anterior / siguiente y el zoom, sus botones.
