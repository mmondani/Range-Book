# Plan — 003 MantisX

**Estado:** Propuesto
**Requerimientos:** [./requerimientos.md](./requerimientos.md)
**Diseño:** [cambios.md](./diseno/cambios.md) · [maqueta](./diseno/maqueta/index.html)

## Resumen del enfoque
Los datos salen de la API interna de `train.mantisx.com` mediante un **bookmarklet** que el usuario ejecuta en esa web con su sesión iniciada. El bookmarklet descarga un JSON (`ejemplos/mantisx-2026-10-15_2026-11-15.json`) que Range Book importa **en el cliente**, sin backend: se mantiene el [ADR 0001](../../decisiones/0001-firebase-desde-el-cliente.md). La importación filtra las sesiones de fuego real "Open Training" y propone a qué ronda de Range Book corresponde cada una, **por la hora**: las rondas pasan a guardar la hora en que se crean. Lo que no tiene ronda o sesión disponible no se importa, y se indica. El usuario corrige la propuesta y confirma.

Cada ronda guarda un **resumen** de su sesión de MantisX embebido (puntaje, split y diagnóstico de cada disparo, unos 1 KB). La **trayectoria** (unos 33 KB por ronda) va en un documento aparte de Firestore, que se lee solo al verla. Así se respeta el límite de 1 MiB del documento de la sesión ([ADR 0002](../../decisiones/0002-rondas-embebidas.md)) y la lista de sesiones no carga trayectorias.

## Impacto en la arquitectura
- **Nuevo:**
  - `src/lib/mantis-import.ts`: lectura y validación del archivo, filtro por tipo y normalización (strings a números, UTC a hora local, descarte de disparos borrados).
  - `src/lib/mantis-matching.ts`: propuesta de matching entre sesiones de MantisX y rondas de Range Book.
  - `src/lib/mantis-problems.ts`: diagnósticos en castellano.
  - `src/lib/mantis-trace.ts`: trayectoria relativa al disparo, fases, conversión de grados a mm a la distancia de la ronda, y mejor/peor disparo y split más rápido/más lento.
  - `src/lib/mantis-bookmarklet.ts`: código del bookmarklet, que hoy está en `spike/`.
  - Colección `users/{uid}/mantisTraces/{mantisSessionPk}`, con su repositorio y sus reglas.
  - Pantalla de importación (`/sesiones/importar-mantisx`) y pantalla MantisX de la ronda (`/sesiones/:id/rondas/:roundId/mantisx`), con la trayectoria estática y su reproducción animada.
- **Modificado:**
  - `Round` (`src/lib/sessions.ts`): campo `createdAt` (hora en que se creó la ronda; `null` en las rondas anteriores a esta iteración) y campo opcional `mantis`. Los dos se parsean al leer y se conservan al reescribir el array crudo.
  - `SessionRepository`: escritura en lote de los resúmenes (una reescritura de `rounds` por sesión afectada).
  - `firestore.rules`: regla explícita para `mantisTraces`.
  - `RoundRow` / `RoundTable`: muestran el resumen MantisX.
  - Encabezado de Sesiones: acción "Importar MantisX".
  - Rutas.
- **Sin cambios pero relevante:** el modo offline ([ADR 0005](../../decisiones/0005-offline.md)). La importación lee un archivo local y escribe en Firestore, así que funciona sin conexión y se sincroniza después. Las reglas de la sesión no recorren las rondas, así que el contenido de `mantis` lo valida el cliente, como el resto de la ronda.

### Modelo de datos
```
sessions/{id}.rounds[i].createdAt  ISO 8601 UTC | null (se pone al crear la ronda; no se edita)
sessions/{id}.rounds[i].mantis?    (opcional; ~1 KB)
  sessionPk, date (ISO UTC), hardware, rightHanded,
  firearm { make, model, caliber }, distance { value, metric },
  shots[{ pk, score, split, problem, angle, triggerHold, triggerPull, cant }]

mantisTraces/{sessionPk}           (~33 KB; se lee solo al ver la trayectoria)
  sampleRate, shots[{ pk, pitch[], yaw[], holdIndex, pullIndex, shotIndex, absolutePitch }]
```
- El ID del documento de la trayectoria es el `pk` de la sesión de MantisX. Reimportar la misma sesión no duplica nada.
- Una sesión de MantisX ya vinculada a una ronda aparece como "Ya importada" y no se vuelve a importar.
- Los valores calculados (tiempo total, promedio, mejor y peor disparo, splits extremos) no se guardan: se calculan al mostrar.
- `angle` es la dirección física del desvío: 0° = derecha, 90° = arriba, sentido antihorario. La mano configurada en MantisX (`rightHanded`) cambia qué diagnóstico corresponde a cada dirección, no el ángulo. Es la conclusión de los 98 disparos de ejemplo (todos de zurdo); se confirma contra la app al implementar.

## Archivos
| Archivo | Acción | Motivo |
|---|---|---|
| `src/lib/mantis-import.ts` (+ test) | crear | Leer, validar, filtrar y normalizar el archivo |
| `src/lib/mantis-matching.ts` (+ test) | crear | Propuesta y edición del matching |
| `src/lib/mantis-problems.ts` (+ test) | crear | Diagnósticos en castellano; los desconocidos se muestran tal cual |
| `src/lib/mantis-trace.ts` (+ test) | crear | Trayectoria relativa, fases, mm a la distancia de la ronda, extremos |
| `src/lib/mantis-bookmarklet.ts` (+ test) | crear | Código del bookmarklet para copiar desde la app |
| `src/test/mantis-fixture.ts` | crear | Fixture recortado del export real (disparos con trayectorias cortas) |
| `src/lib/sessions.ts`, `src/lib/rounds.ts` | modificar | Campos `createdAt` y `mantis` en `Round`: parseo, reescritura cruda, `RoundItem` |
| `src/data/session-repository.ts` | modificar | `createdAt` al crear la ronda; `applyMantisImport`: escribir los resúmenes por sesión |
| `src/data/mantis-trace-repository.ts` | crear | Leer y escribir `mantisTraces` |
| `src/test/fake-*.ts` | modificar / crear | Dobles en memoria de los repositorios |
| `firestore.rules`, `tests/rules/*` | modificar | Reglas de `mantisTraces` (dueño, claves, tamaños) y sus tests |
| `src/routes.tsx` | modificar | Rutas de importación y de la pantalla MantisX de la ronda |
| `src/screens/mantis-import-screen.tsx` (+ test) | crear | Elegir el archivo, revisar y editar el matching, importar |
| `src/screens/mantis-round-screen.tsx` (+ test) | crear | Resumen, disparos y trayectoria de la ronda |
| `src/components/mantis-match-list.tsx` | crear | Lista del matching agrupada por sesión de Range Book |
| `src/components/mantis-skipped-list.tsx` | crear | "No se importan" (con motivo) y "Ya importadas" |
| `src/components/mantis-shot-list.tsx` | crear | Disparos con puntaje, split, diagnóstico y dirección |
| `src/components/mantis-pill.tsx` | crear | "MantisX 88,3 · 17,1 s" en la ronda, link a su pantalla |
| `src/components/trace-playback.tsx` | crear | Reproducir / Pausar / Repetir y velocidad Lenta / Real |
| `src/components/badge.tsx` | modificar | Variante `info` |
| `src/components/mantis-trace.tsx` | crear | Trayectoria de un disparo en SVG, por fase, con reproducción |
| `src/hooks/use-trace-playback.ts` | crear | Reproducción de la trayectoria en tiempo real (`requestAnimationFrame`) |
| `src/components/round-row.tsx`, `round-table.tsx` | modificar | Línea "MantisX 90,6 · 19,7 s" y acceso a su pantalla |
| `src/screens/sessions-screen.tsx` | modificar | Ícono "Importar MantisX" en el encabezado (mobile) y junto al total (desktop) |
| `docs/features/003-mantisx/diseno/` | crear | `cambios.md` y maqueta (después de las preguntas) |

## Dependencias nuevas
- Ninguna. El JSON se lee con `File.text()` y la trayectoria se dibuja en SVG propio, como los demás gráficos.

## Pasos
- [ ] **0. Hora de las rondas**
  - Qué: `createdAt` en `Round`. Se pone al crear la ronda (hora del dispositivo, en UTC), no se edita y se conserva al reescribir. Las rondas existentes quedan con `null`.
  - Verificación: tests de alta de ronda (tiene hora), de edición (no cambia) y de parseo de rondas viejas (`null`).
- [ ] **1. Lectura del archivo**
  - Qué: `mantis-import.ts` valida `source: 'mantisx'` y `formatVersion: 1`, se queda con `fire_type === 1` y `drill_id === 0`, descarta las sesiones y los disparos con `deleted`, pasa los strings a números y la fecha a hora local. Devuelve las sesiones válidas, cuántas se omitieron por tipo y los errores ("El archivo no es un export de MantisX", "Formato desconocido", "El archivo está dañado"). Incluye el fixture recortado.
  - Verificación: tests con el fixture y con archivos inválidos.
- [ ] **2. Diagnósticos y trayectoria**
  - Qué: tabla de diagnósticos en castellano, con fallback al texto original. En `mantis-trace.ts`: trayectoria relativa al punto del disparo, fases (apuntado, gatillo, seguimiento), conversión de grados a mm con la distancia de la ronda (`tan(θ)·d`), tiempo total, promedio y extremos.
  - Verificación: tests unitarios (por ejemplo, 0,1° a 5,49 m ≈ 9,6 mm; tiempo total de la sesión 36042015 = 19,72 s).
- [ ] **3. Matching**
  - Qué: `mantis-matching.ts` agrupa las sesiones de MantisX por fecha local y propone la sesión de Range Book de ese día (si hay varias, la del arma que coincide con la de MantisX). Dentro de la sesión, asigna uno a uno las rondas sin datos de MantisX **respetando el orden y minimizando la diferencia de hora** entre `createdAt` y la fecha de la sesión de MantisX. Las rondas sin hora (anteriores a esta iteración) se asignan por orden. Marca las ya importadas y las que **no se importan**, con el motivo ("No hay sesión de Range Book el 15/11", "No queda ninguna ronda disponible en esa sesión"), y avisa si no coinciden los disparos. Funciones puras para cambiar una asignación sin repetir rondas.
  - Verificación: tests de la propuesta (por hora, por orden sin hora, más sesiones de MantisX que rondas, ninguna sesión ese día, ya importada) y de la edición.
- [ ] **4. Modelo y persistencia**
  - Qué: campo `mantis` en `Round` (parseo tolerante y reescritura cruda), `applyMantisImport` en `SessionRepository`, `mantis-trace-repository.ts`, reglas de `mantisTraces` y dobles en memoria.
  - Verificación: tests de parseo y de reescritura (no se pierde el análisis) y `pnpm test:rules` (dueño, claves, tamaños; otro usuario no lee).
- [ ] **5. Pantalla de importación**
  - Qué: ruta `/sesiones/importar-mantisx` (página completa), con acceso desde el encabezado de Sesiones (mobile) y el encabezado de la lista (desktop). Pasos: elegir el archivo; revisar el matching (agrupado por sesión de Range Book, un select de ronda por sesión de MantisX, con "No importar"); la sección "No se importan" con el motivo de cada una y cuántas se omitieron por tipo de entrenamiento; botón **Importar N rondas**; toast con el resultado. Ayuda "Cómo exportar desde MantisX" con los pasos y el botón **Copiar el marcador**.
  - Verificación: test de pantalla con el archivo de ejemplo (propuesta, edición, importación, ya importadas al reimportar) y prueba manual en mobile y desktop.
- [ ] **6. Ver los datos en la ronda**
  - Qué: línea MantisX en `RoundRow` / `RoundTable` y la pantalla de la ronda: resumen (puntaje promedio, tiempo total, split promedio), lista de disparos (con el mejor y el peor y los splits extremos) y la trayectoria del disparo elegido: **estática** (las tres fases, en mm a la distancia de la ronda) y con **Reproducir / Pausar** para verla animada en tiempo real.
  - Verificación: tests de pantalla (con y sin datos de MantisX, trayectoria que carga, trayectoria faltante, reproducción con el reloj simulado) y prueba manual.
- [ ] **7. Quitar los datos de MantisX de una ronda**
  - Qué: desde la ronda, "Quitar los datos de MantisX" (con "Deshacer"), que borra el resumen y su trayectoria.
  - Verificación: test de pantalla y de repositorio.
- [ ] **8. Cierre**
  - Qué: criterios verificados; `arquitectura.md`, `docs/diseno/` y un ADR "Datos de MantisX por bookmarklet e importación de archivo"; `notas.md`; borrar `spike/` (el código pasa a `src/lib/`).
  - Verificación: `pnpm test`, `pnpm lint`, `pnpm build`.

## Cobertura de criterios de aceptación
| Criterio | Paso(s) | Cómo se verifica |
|---|---|---|
| Importar desde Sesiones un archivo exportado de MantisX | 1, 5 | `mantis-import.test.ts`, `mantis-import-screen.test.tsx` |
| Proponer el matching sesión ↔ sesión y ronda ↔ sesión de MantisX, por la hora | 0, 3, 5 | `mantis-matching.test.ts`, test de pantalla |
| Editar el matching | 3, 5 | `mantis-matching.test.ts`, test de pantalla |
| Guardar lo importado en Firestore | 4 | tests de repositorio y de reglas |
| Datos de cada disparo y de cada sesión de MantisX | 1, 4 | tests de normalización y parseo |
| Valores calculados (tiempo total, promedio, trayectoria relativa, extremos) | 2, 6 | `mantis-trace.test.ts`, test de pantalla |

## Riesgos y alternativas descartadas
- **Riesgo:** la API de MantisX no es oficial y puede cambiar. → **Mitigación:** el bookmarklet guarda la sesión tal cual llega y Range Book valida el formato y da un error claro. Si cambia, se ajusta el bookmarklet o el parser sin tocar lo ya importado.
- **Riesgo:** React bloquea los links `javascript:`, así que no se puede ofrecer un link para arrastrar a la barra de marcadores. → **Mitigación:** botón "Copiar el marcador", con instrucciones para crear el marcador. En mobile es el único camino de todos modos.
- **Riesgo:** la convención de `angle` y el signo de `yaw` no están documentados; se dedujeron de los diagnósticos de un tirador zurdo. → **Mitigación:** comparar con la app al implementar; si hay que corregir, es un cambio en `mantis-trace.ts`.
- **Riesgo:** una ronda cargada mucho después de tirarla (por ejemplo, en casa) tiene una hora que no corresponde. → **Mitigación:** el matching respeta el orden de todos modos y se puede corregir a mano antes de importar.
- **Riesgo:** las trayectorias de rondas o sesiones eliminadas quedan huérfanas en `mantisTraces`, porque "Deshacer" reescribe la ronda tal cual. → **Mitigación:** son chicas y se pisan si se reimporta la misma sesión. Se acepta, como las fotos borradas sin conexión ([ADR 0005](../../decisiones/0005-offline.md)).
- **Alternativa descartada:** Cloud Function que llame a la API de MantisX. → **Por qué:** requiere backend propio y guardar credenciales de MantisX, y Cloudflare puede bloquear las IPs de Google.
- **Alternativa descartada:** trayectorias en Storage. → **Por qué:** el requerimiento pide Firestore; Firestore ya tiene caché offline y reglas por dueño, y las reglas de Storage solo aceptan imágenes.
- **Alternativa descartada:** todo embebido en la ronda. → **Por qué:** unos 33 KB por ronda; una sesión de 30 rondas se acerca al límite de 1 MiB y la lista de sesiones cargaría todas las trayectorias.
- **Alternativa descartada:** CSV oficial de MantisX. → **Por qué:** no trae la trayectoria.

## Preguntas abiertas
- Ninguna. Respondidas el 2026-11-15: hora en las rondas nuevas; lo que no tiene ronda o sesión no se importa y se indica; trayectoria estática y animada; Rendimiento y Evolución fuera de alcance; después de importar solo se quitan los datos; bookmarklet en la app; `angle` es la dirección física (a confirmar contra la app).

## Al terminar
- [ ] Todos los criterios de aceptación verificados
- [ ] Tests y lint pasan
- [ ] `docs/arquitectura.md` actualizado
- [ ] `docs/diseno/` actualizado si la iteración cambió la UI
- [ ] ADR creado si corresponde
- [ ] `notas.md` completado
