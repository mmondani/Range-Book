# Sistema de diseño — RangeBook MVP

**Estado:** Borrador para revisión
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
- **Lo que no cambia con el tema:** la foto del blanco y sus superposiciones (impactos, PMI, grupo), y los botones sobre fotos (fondo `rgba(11,13,15,.75)`).
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
- Carga: Google Fonts con `display=swap`. Se pueden autoalojar para que funcione offline en la PWA.

### Espaciado, radios y elevación

- Escala de 4 pt: `4 8 12 16 20 24 32 40 48`.
- Margen lateral: 16 px en mobile; 32–40 px en desktop.
- Radios: inputs y botones `12px`, tarjetas `16px`, sheets `24px` (arriba), chips `999px`, miniaturas `8–10px`.
- Elevación: casi plana. Las tarjetas se separan con borde, no con sombra. Solo el FAB y los sheets llevan sombra (`0 8px 24px rgba(0,0,0,.5)`).
- Capas (z-index): contenido 0, header fijo 10, barra inferior 20, FAB 30, scrim y sheet 40, toast 50.

### Movimiento

- Duraciones: 120 ms al presionar, 200 ms para cambios de estado, 280 ms al entrar un sheet o diálogo (y 180 ms al salir).
- Easing: `cubic-bezier(.2,.8,.2,1)` al entrar y `cubic-bezier(.4,0,1,1)` al salir.
- Respetar `prefers-reduced-motion`: sin desplazamientos, solo fundidos.

## Íconos

- Set: **Lucide** (`lucide-react`), trazo 2 px y 24 px (18 px en chips y botones chicos). Es el set que se dibujó en la maqueta.
- Mapeo: Sesiones `Crosshair`, Rendimiento `TrendingUp`, Inventario `Package`, Perfil `User`, Cámara `Camera`, Galería `Image`, Modificación `Wrench`, Configuración `Layers`, Detectar `WandSparkles`, Agregar impacto `CirclePlus`, Quitar impacto `CircleMinus`, Deshacer `Undo2`, Polígono `MapPin`. Clima: `Sun`, `Cloud`, `CloudRain`, `CloudFog`, `Wind`.
- Un ícono decorativo junto a un texto lleva `aria-hidden`. Un botón que solo tiene ícono lleva `aria-label`.
- Logo provisorio: diana con cruz dentro de un cuadrado redondeado naranja (se ve en Login y en el sidebar).

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
| `IconButton` | 40–44 px; sobre foto con fondo `rgba(11,13,15,.75)` | `aria-label` obligatorio |
| `Fab` | Extendido (ícono + texto), 56 px | Solo en la lista de sesiones (mobile) |
| `Chip` | `filter` (con caret), `selectable` (`.on`), `removable` (con ✕ de 32 px), `add` (borde punteado) | Los grupos de chips se acomodan en varias líneas, sin scroll horizontal |
| `Badge` | `success`, `warning`, `accent`, `neutral` | Con texto siempre |
| `Card` | Base y `interactive` (hover en el borde) | La tarjeta clickeable es un `<a>` |
| `StatTile` | Eyebrow + número display + unidad + delta o ayuda | Usado en totales de sesión, KPIs y métricas |
| `Field` | Label + control + ayuda + error | Asterisco naranja si es obligatorio. El error va debajo del campo, con `aria-describedby` y `role="alert"` |
| `Input`, `Select`, `Textarea`, `DateInput` | Alto 48 px en mobile y 44 px en desktop | Controles nativos (`type="date"`, `inputmode="numeric"`, `datalist` para calibre) |
| `Stepper` | − valor + | Para cantidad de disparos |
| `SegmentedControl` | 2–3 opciones | Unidades, tema, modo del analizador |
| `Tabs` | Mobile: chips seleccionables; desktop: tabs subrayados | Inventario |
| `ZoneEditor` | Filas puntaje + diámetro, Generar anillos uniformes, vista previa | Alta de blanco (M12) |
| `PhotoPicker` | Botones Cámara / Galería, miniaturas con quitar, portada | Cámara: `<input type=file accept=image/* capture=environment>`. Galería: igual pero sin `capture`. En desktop, zona para arrastrar archivos |
| `PhotoGallery` | Imagen principal + miniaturas, contador "1 / 3" | Imágenes con `aspect-ratio` reservado |
| `BottomSheet` / `Dialog` | Sheet en mobile y diálogo centrado en desktop | Agarrador, botón cerrar, scrim .7. Pide confirmación si hay cambios sin guardar |
| `ConfirmDialog` | Destructivo | Para eliminar cualquier entidad |
| `Toast` | Éxito o error, con "Deshacer" opcional | `aria-live="polite"`, se cierra solo a los 4 s |
| `EmptyState` | Ícono + texto + acción | Para listas vacías y gráficos sin datos |
| `Skeleton` | Tarjetas, filas, gráficos | Si la carga tarda más de 300 ms |
| `SessionCard` | Fecha en bloque, configuración, polígono · munición, clima, rondas / disparos / promedio | Variante "Hoy" con borde y badge de acento |
| `RoundRow` | Miniatura del blanco, ronda, blanco, distancia, disparos, puntaje, grupo, estado de análisis, CTA "Analizar" | En desktop es una fila de tabla |
| `TargetThumb` | Blanco dibujado o foto con impactos | — |
| `TargetAnalyzer` | Foto, impactos, PMI (cruz azul), círculo de grupo (punteado naranja), modos Detectar / Agregar / Quitar, Deshacer | Ver `pantallas.md` → Análisis |
| `MetricTile` | Puntaje (+ distribución por zona), tamaño de grupo (mm + MOA), desvío del PMI, distancia al centro | Unidad en mm o pulgadas, según el perfil |
| `LineChart`, `BarChart` | Ejes con unidad, último punto destacado, `aria-label` con el resumen | Grilla tenue. Tooltip al tocar o pasar el mouse |
| `DataTable` | Ordenable (`aria-sort`), scroll horizontal en su contenedor | Rendimiento, inventario, impactos |

## Accesibilidad (mínimos)

- Contraste del texto ≥ 4.5:1 en todos los pares de tokens de arriba, en los dos temas (verificado: el texto de acento y de estado sobre su fondo tintado también cumple).
- Áreas táctiles ≥ 44×44 px, con ≥ 8 px entre una y otra.
- Foco visible: `outline: 2px solid var(--accent); outline-offset: 2px`.
- Jerarquía de headings sin saltos. Cada ruta mueve el foco al `<h1>`.
- Todo lo que se hace con gestos tiene un control visible. En el analizador, quitar un impacto también se puede hacer desde la tabla de impactos.
