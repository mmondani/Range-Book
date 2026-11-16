# Cambios de diseño — 003 MantisX

**Estado:** Propuesto
**Plan:** [../plan.md](../plan.md) · **Maqueta:** [maqueta/index.html](./maqueta/index.html)

La maqueta trae solo las pantallas nuevas o modificadas; el resto sigue en [`docs/diseno/maqueta/`](../../../diseno/maqueta/index.html). La trayectoria se dibuja con los datos reales de la sesión 36042499 de MantisX (`maqueta/assets/mantis-data.js`). Los demás datos son ilustrativos y no siempre coinciden entre pantallas.

## Pantallas nuevas

### M14 / W09 · Importar MantisX (`/sesiones/importar-mantisx`)
Página completa (oculta la barra inferior en mobile). Dos etapas en la misma ruta: elegir el archivo y revisar el matching.

**1 · Elegir el archivo** (`mobile/importar-mantisx.html`)
- Título "Importar MantisX" y una línea que explica qué se suma a las rondas.
- Tarjeta con la acción primaria **Elegir archivo** (`<input type="file" accept=".json,application/json">`). Aclara que solo se importan las sesiones de fuego real de "Open Training". En desktop también se puede soltar el archivo sobre la página.
- **Cómo exportar desde MantisX** (desplegable, abierto si nunca se importó): los pasos y el botón **Copiar el marcador**, que copia el código del bookmarklet al portapapeles y cambia a "Marcador copiado". No se ofrece un link para arrastrar porque React bloquea los `javascript:`. Nota: "Tu contraseña de MantisX nunca pasa por Range Book".
- **Errores** (`Alert` danger, debajo de la tarjeta): "El archivo no es un export de MantisX" · "Este archivo es de una versión más nueva del marcador: actualizá Range Book" · "No se pudo leer el archivo" · "El archivo no tiene sesiones de fuego real de «Open Training»".

**2 · Revisión** (`mobile/importar-mantisx-revision.html`, `web/importar-mantisx.html`)
- Nombre del archivo y **Cambiar archivo** (vuelve a la etapa 1). En desktop, una columna lateral con el archivo (sesiones y rango de fechas), "Elegir otro archivo" y la ayuda resumida.
- **Una tarjeta por sesión de Range Book** con sesiones de MantisX propuestas: fecha (eyebrow), "arma · configuración", "polígono · N rondas". Dentro, una fila por sesión de MantisX: hora local, disparos y puntaje promedio, y el select **Ronda** con las rondas de esa sesión ("Ronda 1 · 10:08 · 5 disparos"; sin hora en las rondas viejas: "Ronda 1 · 5 disparos") y **No importar**. Una ronda elegida en otra fila sale de las opciones de las demás. En desktop es una tabla (Sesión de MantisX, Disparos, Puntaje, Ronda de Range Book).
- **Aviso** (texto `--warning` con ícono, `aria-describedby` del select) si los disparos no coinciden: "La ronda 4 tiene 10 disparos y MantisX registró 5". No bloquea.
- **No se importan N**: cada sesión de MantisX sin ronda o sin sesión, con su motivo: "No queda ninguna ronda disponible en esa sesión" o "No hay ninguna sesión de Range Book el 31/10". Debajo del título: "Para importarlas, cargá la sesión o la ronda en Range Book y volvé a elegir el archivo."
- **Ya importadas N** (desplegable cerrado): dónde está cada una ("En la ronda 1 de la sesión del 25/10").
- Nota final: "Se omitieron N sesiones de otros entrenamientos (…)", con los nombres de los entrenamientos omitidos.
- Barra fija (mobile) o botón del encabezado (desktop): **Importar N rondas**, deshabilitado con N = 0. Al terminar, vuelve a Sesiones con el toast "Se importaron N rondas de MantisX".
- **Estados:** leyendo el archivo (spinner en el botón) · nada para importar (EmptyState "No hay nada nuevo para importar" con el detalle de lo omitido y "Elegir otro archivo") · importando (botón con spinner) · sin conexión (importa igual: se sincroniza al volver, como el resto).
- Salir con una revisión sin importar pide confirmación ("¿Descartar la importación?").

### M15 / W10 · MantisX de la ronda (`/sesiones/:id/rondas/:roundId/mantisx`)
Página completa. `mobile/ronda-mantisx.html`, `web/ronda-mantisx.html`.
- Volver a la sesión (desktop: ruta "Sesiones / fecha / Ronda N"). Eyebrow "Ronda 1 · 15 nov 2026 · 11:04" (fecha y hora de MantisX), título **MantisX** y "sensor · arma de MantisX · mano · entrenamiento".
- **Resumen** (tres `StatTile`): puntaje promedio, tiempo total (suma de los splits) y split promedio (sin el primer disparo). Nota: "El puntaje de MantisX mide el control del gatillo, no dónde pegó el disparo en el blanco."
- **Trayectoria** (`MantisTrace`), del disparo elegido ("Disparo 1 de 5", con anterior / siguiente):
  - Cuadro de 280 px (mobile) o 386 px (desktop) sobre `--surface-2`: ejes, dos círculos de referencia punteados con su medida en mm (escala automática que entra el apuntado y la presión del gatillo; el seguimiento puede salir del cuadro y se recorta).
  - La trayectoria es relativa al disparo y en mm a la distancia de la ronda (`tan(Δángulo) × distancia`). **Apuntado** `--info` 2 px, **presión del gatillo** `--warning` 3 px y **seguimiento** `--accent` 2 px punteado; el disparo es una ✕ `--text`. Las fases se distinguen también por grosor y trazo, no solo por color. Leyenda debajo.
  - **Reproducir / Pausar** (y "Repetir" al terminar): dibuja la trayectoria en el tiempo, con un punto en la posición actual y el tiempo relativo al disparo ("−0,15 s"). **Velocidad**: Lenta (¼, por defecto) o Real (un disparo dura ~0,75 s). Cambiar de disparo detiene la reproducción y muestra la trayectoria completa.
  - Datos del disparo: puntaje, split, diagnóstico (en castellano), dirección (hora de reloj, como el PMI), **inclinación arma** (cant: giro lateral del arma al disparar, en grados; sin lado hasta confirmar el signo de `absolute_roll`), **mov. apuntando** y **mov. disparando**, sin unidad: son índices de MantisX (`trigger_hold`, `trigger_pull`), proporcionales al movimiento del arma antes de presionar el gatillo y durante la presión, pero con una fórmula propia.
- **Disparos** (`MantisShotList`): una fila-botón por disparo (`aria-pressed`) con número, puntaje, "Split 3,90 s" ("Primer disparo" en el primero), diagnóstico, flecha de dirección con su hora, y badges **Mejor**, **Peor**, **Split más rápido** y **Split más lento**. La elegida se resalta como un chip seleccionado.
- **Quitar los datos de MantisX** (botón `danger`): confirmación y toast con "Deshacer"; vuelve a la sesión.
- **Estados:** cargando la trayectoria (skeleton del cuadro) · trayectoria no disponible (todavía sin sincronizar o borrada: "No se pudo cargar la trayectoria", el resto se ve igual) · la ronda no tiene datos de MantisX (vuelve a la sesión).

## Pantallas modificadas

### M02 / W02 · Sesiones
- Mobile: ícono **Importar MantisX** (`FileUp`) en el encabezado, antes de Buscar y Filtrar.
- Desktop: el mismo ícono con `title`, al lado de "N en total".

### M03 / W02 · Detalle de sesión (rondas)
- `RoundRow`: si la ronda tiene datos de MantisX, una píldora `--info` debajo del blanco y la distancia: ícono `Activity` + "MantisX 88,3 · 17,1 s" (puntaje promedio · tiempo total), link a M15. Queda por encima del link estirado de la tarjeta (como el lápiz).
- `RoundTable` (desktop): columna **MantisX** con "88,3 · 17,1 s" como link (o "—").

## Cambios en `pantallas.md`
- Tabla de rutas: `/sesiones/importar-mantisx` (M14 / W09) y `/sesiones/:id/rondas/:rid/mantisx` (M15 / W10).
- Secciones nuevas M14 / W09 y M15 / W10 (lo de arriba). En M02 y M03, las modificaciones.
- M05: las rondas guardan la hora en que se crean (no se ve ni se edita; se usa para la importación).
- "Decisiones tomadas": MantisX por bookmarklet + archivo; se importa solo fuego real "Open Training"; matching por hora; lo que no tiene ronda o sesión no se importa; después de importar solo se quitan los datos; Rendimiento y Evolución no usan MantisX todavía.

## Cambios en `design-system.md`
- **Íconos:** Importar MantisX `FileUp`, MantisX `Activity`, Elegir archivo `Upload`, Copiar `Copy`, Reproducir `Play`, Pausar `Pause`, Aviso `TriangleAlert`.
- **Componentes nuevos:**

| Componente | Variantes / estados | Notas |
|---|---|---|
| `MantisMatchList` | Tarjeta por sesión de Range Book con filas (mobile) o tabla (desktop); select de ronda con "No importar"; aviso de disparos | Las opciones de cada select excluyen las rondas elegidas en otras filas |
| `MantisSkippedList` | "No se importan" (con motivo) y "Ya importadas" (desplegable) | — |
| `MantisTrace` | Cuadro con ejes, círculos de referencia, fases (`--info` 2 px, `--warning` 3 px, `--accent` 2 px punteado), ✕ del disparo, punto y tiempo durante la reproducción | `role="img"` con `aria-label` ("Trayectoria del disparo 1: …, círculos de 15 y 30 mm") |
| `TracePlayback` | Reproducir / Pausar / Repetir + `SegmentedControl` Lenta / Real | La reproducción la inicia el usuario; con `prefers-reduced-motion` se mantiene (es el contenido) |
| `MantisShotList` | Filas-botón con `aria-pressed`; badges Mejor (`success`), Peor (`warning`), Split más rápido (`info`), Split más lento (`neutral`); flecha de dirección + hora de reloj | Alternativa accesible a la flecha: el `aria-label` de la fila dice puntaje, split y diagnóstico |
| `MantisPill` | Píldora `--info` 14 % con ícono `Activity` y "MantisX 88,3 · 17,1 s" | En `RoundRow`; link a M15 |

- **Badge:** variante `info` (fondo `--info` al 14 %), para "Split más rápido".
- **Diagnósticos en castellano** (`src/lib/mantis-problems.ts`; los desconocidos se muestran tal cual):

| MantisX | Range Book |
|---|---|
| GREAT SHOT | Buen disparo |
| PUSHING FORWARD | Empujar hacia adelante |
| SLAPPING TRIGGER | Golpear el gatillo |
| TIGHTENING FINGERS | Cerrar los dedos |
| TIGHTENING GRIP | Apretar el agarre |
| HEELING | Empujar con la palma |
| TOO LITTLE TRIGGER FINGER | Poco dedo en el gatillo |
| TOO MUCH TRIGGER FINGER | Mucho dedo en el gatillo |
| PUSHING | Empujar (anticipar el retroceso) |
| BREAKING WRIST UP | Quebrar la muñeca hacia arriba |
