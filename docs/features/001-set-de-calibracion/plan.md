# Plan — 001 Set de calibración de la detección

**Estado:** En pausa (ver notas.md)
**Requerimientos:** [./requerimientos.md](./requerimientos.md)
**Diseño:** [cambios.md](./diseno/cambios.md) · [maqueta](./diseno/maqueta/index.html)

## Resumen del enfoque
La herramienta es una segunda app de Vite en `calibration/`, con su propio `index.html` y `vite.config.ts`, que importa de `src/` lo que ya existe. La lógica viene de `src/lib/` (calibración, detección, compresión) y los componentes del analizador de `src/components/` (`TargetAnalyzer`, `MarkerPicker`, `CalibrationPanel`). Así se marca con el mismo zoom y los mismos marcadores que la app, sin escribirlos de nuevo y sin tocar el build de la app.

El set es una carpeta (`calibration/dataset/`, fuera del repo) que la herramienta abre con la API de acceso a archivos del navegador. Las fotos viven ahí y `dataset.json` se escribe solo en cada cambio. Guardar, exportar e importar pasan a ser lo mismo: abrir la carpeta.

La evaluación corre en la misma herramienta y en el navegador (pestaña **Evaluar**), con el mismo camino que la foto recorre en la app: compresión a 2000 px, reducción y detección. Para que ese camino sea idéntico y no una copia, la parte de `AnalysisScreen` que prepara y corre la detección pasa a `src/lib/`. Los parámetros de la detección (umbral y filtros) pasan a ser opcionales, con los valores actuales por defecto.

## Impacto en la arquitectura
- **Nuevo:**
  - `calibration/`: herramienta de desarrollo, que no se despliega. React, sin router ni Firebase. Usa los tokens y componentes de la app.
  - `calibration/dataset/` (en `.gitignore`): fotos, `dataset.json` y `resultados/`.
  - Formato `dataset.json` v1:
    ```
    { version: 1,
      targets: [{ id, name, scoring, referenceSizeMm, zones[{score, diameterMm}] }],
      photos:  [{ file, width, height, status ('pending'|'in-progress'|'done'|'discarded'),
                  caliber, targetId|null, shots|null, calibration|null (Calibration, px de la original),
                  impacts[{ x, y, tags: ('touching'|'outside'|'old')[] }],
                  conditions: ('even'|'shadow'|'flash'|'angled'|'blurry'|'old-holes')[], notes }] }
    ```
  - Formato del portapapeles de un blanco: `{ "rangebook": "target", "version": 1, name, scoring, referenceSizeMm, zones }`.
- **Modificado:**
  - `impact-detection.ts`:
    - `DetectionOptions` suma parámetros opcionales: ventana, erosión, área mínima y máxima, lado máximo y ocupación mínima. Los valores por defecto son los de hoy, así que el comportamiento no cambia.
    - Funciones nuevas `detectImpactsInPhoto(pixels, calibration, zones, holeMm, options?)` y `detectCenterInPhoto(pixels, size)` (esta en `target-center.ts`). Reciben la foto ya reducida y devuelven los puntos en píxeles de la foto calibrada, con el `+0.5` y la escala por eje que hoy hace `AnalysisScreen`.
  - `AnalysisScreen` usa esas funciones (sin cambio de comportamiento).
  - `targets.ts` suma `targetClipboardText` y `parseTargetClipboard`.
  - `TargetSheet` (M12) suma "Copiar para calibración" al editar.
  - `package.json`, `tsconfig.app.json`, `eslint.config.js`, `vite.config.ts` (`test.include`) y `.gitignore` suman la carpeta nueva.
- **Sin cambios pero relevante:** `compressImage` y `readImagePixels` se usan tal cual en la evaluación. Las fotos de la app siempre pasan por la compresión, así que se evalúa sobre lo mismo que ve la app.

## Archivos
| Archivo | Acción | Motivo |
|---|---|---|
| `src/lib/impact-detection.ts` (+ test) | modificar | Parámetros opcionales y `detectImpactsInPhoto` |
| `src/lib/target-center.ts` (+ test) | modificar | `detectCenterInPhoto` |
| `src/screens/analysis-screen.tsx` | modificar | Usar las funciones extraídas |
| `src/lib/targets.ts` (+ test) | modificar | Texto del portapapeles de un blanco y su lectura |
| `src/screens/target-sheet.tsx` (+ test) | modificar | Botón "Copiar para calibración" |
| `calibration/index.html`, `calibration/vite.config.ts` | crear | Entrada y config de la herramienta (alias `@` → `src`, sin PWA) |
| `calibration/README.md` | crear | Cómo se usa: abrir la carpeta, marcar y evaluar |
| `calibration/src/main.tsx`, `calibration/src/app.tsx` | crear | Arranque y layout: lista de fotos, foto, panel; pestañas Marcar / Evaluar |
| `calibration/src/lib/dataset.ts` (+ test) | crear | Tipos, validación y lectura de `dataset.json`, estados, alta de fotos y blancos |
| `calibration/src/lib/labeling.ts` (+ test) | crear | Edición de una foto: impactos con etiquetas, deshacer, aviso de impactos ≠ disparos, propuesta de la detección |
| `calibration/src/lib/evaluation.ts` (+ test) | crear | Emparejamiento, métricas y agregados (set, foto, etiqueta, condición) |
| `calibration/src/lib/evaluation-runner.ts` | crear | Camino de la app por foto: comprimir, escalar la calibración, reducir y detectar (necesita canvas) |
| `calibration/src/data/dataset-folder.ts` | crear | Carpeta del set con la API de acceso a archivos: listar fotos, leer y escribir JSON, copiar fotos, recordar la carpeta (IndexedDB) |
| `calibration/src/test/fake-folder.ts` | crear | Carpeta en memoria para los tests |
| `calibration/src/components/*.tsx` | crear | `PhotoList`, `PhotoDetails`, `TargetPaste`, `LabelingView`, `EvaluationView`, `ParameterForm`, `ResultsTable` (uno por archivo) |
| `calibration/src/**/*.test.tsx` | crear | Tests de los criterios de aceptación de la herramienta |
| `package.json`, `tsconfig.app.json`, `eslint.config.js`, `vite.config.ts`, `.gitignore` | modificar | Script `pnpm calibration`, tipos, lint, tests y exclusión del set |

## Dependencias nuevas
- Ninguna.

## Pasos
- [x] **1. Detección reutilizable y parametrizable**
  - Qué: parámetros opcionales en `DetectionOptions` (por defecto, los de hoy) y `detectImpactsInPhoto` / `detectCenterInPhoto` en `src/lib/`. `AnalysisScreen` pasa a usarlas.
  - Verificación: los tests actuales de detección y de `analysis-screen` pasan sin cambios. Tests nuevos: con otros parámetros cambia el resultado sobre un blanco sintético, y la conversión de coordenadas da lo mismo que antes.
- [x] **2. Copiar un blanco desde la app**
  - Qué: `targetClipboardText` / `parseTargetClipboard` y el botón en M12 (solo al editar, copia lo guardado, toasts "Blanco copiado" / "No se pudo copiar").
  - Verificación: tests de ida y vuelta del formato (incluido texto inválido) y de la pantalla con el portapapeles simulado. Revisión en el navegador contra la maqueta.
- [x] **3. Esqueleto de la herramienta**
  - Qué: `calibration/` con `index.html`, config de Vite, `main.tsx`/`app.tsx` vacíos con los tokens de la app; script `pnpm calibration`; tsconfig, lint, `test.include` y `.gitignore` (`calibration/dataset/`); README.
  - Verificación: `pnpm calibration` abre la página. `pnpm build` no incluye nada de `calibration/` en `dist/`. `pnpm lint` y `pnpm test` pasan.
- [x] **4. Modelo del set**
  - Qué: `dataset.ts`: tipos del formato v1, validación al leer (con errores claros si el archivo está dañado o es de otra versión), alta de fotos (nombre de archivo y tamaño), estados (pasa a "en progreso" al marcar algo; "lista" y "descartada" se eligen a mano) y blancos pegados.
  - Verificación: tests de `dataset.ts` (ida y vuelta, archivo dañado, versión desconocida, transiciones de estado).
- [x] **5. Carpeta del set**
  - Qué: `dataset-folder.ts`: elegir la carpeta, listar las imágenes, leer `dataset.json` (o arrancar uno vacío), escribirlo solo en cada cambio (agrupando los cambios seguidos), copiar a la carpeta las fotos que se agregan y recordar la carpeta entre recargas (pide volver a dar permiso con un clic).
  - Verificación: tests con `fake-folder.ts` (fotos nuevas en la carpeta, `dataset.json` existente, guardado). Prueba manual en Chrome: recargar y seguir.
- [x] **6. Lista de fotos y carga**
  - Qué: `PhotoList` con estado y contador; agregar fotos eligiéndolas o arrastrándolas; anterior/siguiente con el teclado (`[` / `]` o PgUp / PgDn); descartar y recuperar una foto.
  - Verificación: tests de pantalla (carga de varias, estados, navegación con el teclado, descartar).
- [x] **7. Datos de la foto y blancos**
  - Qué: `PhotoDetails` (calibre, blanco, disparos, condiciones, notas) y `TargetPaste` (pegar con el botón o en un campo de texto; si el blanco ya existe, se actualiza).
  - Verificación: tests de pantalla (pegar un blanco copiado de la app y usarlo en dos fotos; texto inválido muestra el error).
- [x] **8. Calibración**
  - Qué: `LabelingView` en modo calibrar con `TargetAnalyzer`, `MarkerPicker` y `CalibrationPanel`: anillos (centro, anillo y forma) y sin zonas (dos puntos y distancia), con los anillos dibujados.
  - Verificación: tests de pantalla para los dos tipos de blanco. Prueba manual con una foto real.
- [x] **9. Marcado de impactos**
  - Qué: modos Agregar, Quitar y Etiquetar (tocar un impacto lo selecciona y se le marcan las etiquetas); deshacer (`Ctrl+Z`); contador contra los disparos; botón "Ver la detección actual", que muestra la propuesta como marcadores aparte, y "Usar como punto de partida", que la copia a lo marcado, entra al historial y no marca nada como "lista"; botón "Marcar como lista".
  - Verificación: tests de `labeling.ts` y de pantalla (agregar, quitar, etiquetar, deshacer, aviso de cantidad, propuesta separada de lo marcado).
- [x] **10. Métricas de la evaluación**
  - Qué: `evaluation.ts`:
    - Empareja cada impacto marcado con a lo sumo una detección: de a pares por distancia creciente, a menos de medio diámetro de agujero.
    - Calcula impactos encontrados, detecciones correctas, error de posición en mm y error del centro en mm (o "sin centro").
    - Agrega para el set, por foto y por condición. Por etiqueta solo se agregan los impactos encontrados, porque las detecciones no tienen etiqueta.
  - Verificación: tests con casos calculados a mano y con blancos sintéticos (`src/test/synthetic-target.ts`) corridos por `detectImpactsInPhoto` con resultados conocidos, y con otros parámetros.
- [x] **11. Pestaña Evaluar**
  - Qué:
    - `ParameterForm` con los parámetros (por defecto, los de la app) y `evaluation-runner.ts`, que recorre las fotos "listas" una por una, con progreso y sin congelar la página entre foto y foto.
    - `ResultsTable` con el set, por foto, por etiqueta y por condición.
    - Al terminar, el resultado se imprime en la consola (`console.table`) y se guarda en `resultados/AAAA-MM-DD-HHMMSS.json` dentro de la carpeta, con los parámetros usados.
  - Verificación: test de pantalla con el runner simulado. Prueba manual con el set real: los valores por defecto dan lo mismo que la app al detectar esa foto.
- [ ] **12. Prueba con fotos reales y cierre**
  - Qué: marcar unas fotos reales (una con rotación EXIF), recargar, cerrar y volver a abrir la carpeta, y correr una evaluación.
  - Verificación: criterios de aceptación de abajo.

## Cobertura de criterios de aceptación
| Criterio | Paso(s) | Cómo se verifica |
|---|---|---|
| Se cargan varias fotos a la vez y se ven con su estado | 5, 6 | test de `PhotoList` / prueba manual |
| Se calibra (anillos y sin zonas), se marcan impactos con etiquetas, se quitan y se deshace | 8, 9 | tests de `LabelingView` y `labeling.ts` |
| Al recargar, lo marcado sigue ahí | 5 | test con `fake-folder.ts` / prueba manual en Chrome |
| `dataset.json` tiene todos los datos y coordenadas en píxeles de la original | 4, 5 | tests de `dataset.ts` |
| Importar ese `dataset.json` con las fotos deja todo como estaba | 4, 5 | test de ida y vuelta / prueba manual (abrir la carpeta) |
| Foto con rotación EXIF: marcas en el mismo lugar que en la app | 8, 11, 12 | prueba manual (jsdom no decodifica imágenes) |
| `pnpm build` no incluye la herramienta | 3 | revisar `dist/` después del build |
| Un blanco del inventario se copia sin cargar sus zonas a mano | 2, 7 | tests de `targets.ts`, `TargetSheet` y `TargetPaste` |
| Las fotos y el `dataset.json` no aparecen en `git status` | 3 | prueba manual |
| El script de evaluación informa los valores esperados sobre un set conocido | 10 | tests de `evaluation.ts` con blancos sintéticos |
| Con otros parámetros, resultados distintos sin cambios en `src/lib/` | 1, 10, 11 | test de `evaluation.ts` / prueba manual |

## Riesgos y alternativas descartadas
- **Riesgo:** la API de acceso a archivos solo existe en Chrome y Edge de escritorio. → **Mitigación:** es una herramienta de desarrollo para PC. Si el navegador no la tiene, se avisa al abrir.
- **Riesgo:** sacar la detección de `AnalysisScreen` puede cambiar su comportamiento. → **Mitigación:** paso 1 aislado, con los tests actuales sin tocar y un test de que las coordenadas salen iguales.
- **Riesgo:** la evaluación de 30 fotos bloquea el hilo principal unos segundos por foto. → **Mitigación:** una foto por vez, cediendo el control entre fotos, con barra de progreso. Un Web Worker queda para más adelante si molesta.
- **Riesgo:** el set copia las fotos al agregarlas, así que ocupa lugar en disco. → **Mitigación:** se aclara en el README. Las fotos de 4–8 MB × 30 no son un problema.
- **Alternativa descartada:** evaluar con un script de Node (`pnpm calibration:eval`). → **Por qué:** Node no decodifica JPEG sin una dependencia (`sharp`), y su redimensionado no es el del canvas del navegador. Se evaluaría sobre píxeles distintos a los de la app. Ver pregunta abierta 1.
- **Alternativa descartada:** guardar el progreso en IndexedDB y exportar o importar `dataset.json` con botones. → **Por qué:** duplica las fotos en el navegador y deja dos copias del set que pueden diferir. Con la carpeta hay una sola.
- **Alternativa descartada:** cargar los blancos con login a Firebase desde la herramienta. → **Por qué:** suma auth y reglas a una herramienta local. Copiar y pegar alcanza para unos pocos blancos.

## Preguntas abiertas
Resueltas:
1. La evaluación corre en la herramienta, en el navegador (pestaña Evaluar), no con un comando de Node.
2. La herramienta funciona solo en Chrome.
3. "Copiar para calibración" se ve siempre al editar un blanco.

## Al terminar
- [ ] Todos los criterios de aceptación verificados
- [ ] Tests y lint pasan
- [ ] `docs/arquitectura.md` actualizado
- [ ] `docs/diseno/` actualizado si la iteración cambió la UI
- [ ] ADR creado si corresponde
- [ ] `notas.md` completado
