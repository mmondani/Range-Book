# Notas — 001 Set de calibración de la detección

## Decisiones tomadas al aprobar el plan
- **Evaluación en el navegador, no un script de Node:** el requerimiento pedía "un script (por ejemplo `pnpm calibration:eval`)" con salida en la consola. Se aprobó correrla en la herramienta (pestaña Evaluar), que imprime el resultado en la consola y lo guarda en un archivo: así se evalúa sobre los mismos píxeles que la app (canvas del navegador) y sin dependencias.
- **Solo Chrome** (API de acceso a archivos).
- **"Copiar para calibración" visible siempre** al editar un blanco.

## Desvíos del plan
- **Orden de los pasos:** las métricas de la evaluación (paso 10) y la detección sobre una foto (`detectInPhoto`, parte del paso 11) se hicieron antes de la interfaz, porque "Ver la detección actual" del paso 9 las usa.
- **Archivos extra** (no estaban en la tabla del plan):
  - `calibration/src/lib/folder-sync.ts`: abrir el set, importar fotos y guardar, sobre la interfaz `DatasetFolder`. Así `dataset-folder.ts` queda solo con la API del navegador y lo demás se testea con `fake-folder.ts`.
  - `calibration/src/lib/tuning.ts`: campos y lectura del formulario de parámetros.
  - `calibration/src/services.ts`: lo que la herramienta usa del navegador, inyectable en los tests, y un `PhotoRepository` local para `TargetAnalyzer`.
  - `calibration/src/file-system.d.ts`: tipos de la API de acceso a archivos que no están en `lib.dom`.
  - Hooks `use-dataset-folder.ts` (guardado automático, de a una escritura) y `use-photo-source.ts`.
  - Componentes `FolderGate`, `Workspace` y `PhotoArea`. `TargetPaste`, `PhotoDetails`, `PhotoList`, `LabelingView`, `EvaluationView`, `ParameterForm` y `ResultsTable` estaban en el plan.
  - Un solo `tool.module.css` para toda la herramienta, en lugar de un CSS Module por componente (interfaz mínima).
- **`scaleCalibration`** (en `labeling.ts`): la calibración se marca sobre la foto original y la detección corre sobre la comprimida (2000 px), así que se escala.
- **"Quitar una foto del set" = descartarla:** queda en la carpeta y en `dataset.json` con el estado "Descartada", y no entra en la evaluación. Se puede recuperar. No se borra ningún archivo.
- **La herramienta no propone el centro solo**, a diferencia del análisis de la app: el centro se marca a mano porque es la "verdad" contra la que se evalúa la detección del centro.
- **"Usar como punto de partida" reemplaza lo marcado** por la propuesta (se puede deshacer). No mezcla las dos.
- **Etiquetar:** tocar la foto elige el impacto más cercano, en lugar de que los impactos sean botones como en Quitar (que los muestra en rojo).
- **Calibración sin "Continuar":** cada borrador válido se guarda enseguida como calibración de la foto.
- **Cambiar a un blanco de otro tipo** (anillos ↔ sin zonas) borra la calibración de la foto, que ya no sirve.

## Bugs encontrados en la implementación
- El formulario de parámetros mostraba los valores con `formatDecimal`, que redondea a un decimal: 0,35 aparecía como 0,4 y la evaluación "por defecto" no usaba los parámetros de la app. Se muestran sin redondear (test en `tuning.test.ts`).
- **Encontrado al probarla:** una foto sin blanco elegido no se mostraba (solo el aviso), y en un set nuevo ninguna tiene blanco, así que parecía que las fotos no cargaban. Ahora la foto se ve siempre; sin blanco no se puede calibrar ni marcar, y se avisa arriba de la foto.

## Pendientes
- **Revisión en el navegador (Chrome), que no se pudo hacer desde acá.** El diálogo para elegir la carpeta es nativo y la app necesita el login de Google:
  - M12 contra la maqueta: botón "Copiar para calibración", toasts, en los dos temas, en 375 px y 1280 px.
  - La herramienta: abrir la carpeta, recargar y "Seguir con «carpeta»", agregar fotos arrastrándolas, zoom y arrastre de marcadores, "Forma", y que la evaluación con los parámetros por defecto dé lo mismo que "Detectar" en la app con la misma foto.
  - Una foto con rotación EXIF: que las marcas queden en el mismo lugar que en la app (jsdom no decodifica imágenes).
- Paso 12 completo: marcar fotos reales y correr una evaluación.

## En pausa (2026-10-28)
La iteración quedó en pausa en esta rama, sin pasar a `main`, a pedido. Ningún cambio de la app (detección parametrizable, "Copiar para calibración") llega a producción hasta retomarla.

Lo que se aprendió con el primer set (22 fotos listas, 141 impactos, 12 corridas):
- Con los parámetros de la app: 54 % de impactos encontrados y 60 % de detecciones correctas; la posición de los encontrados es buena (0,7 mm de error medio). El centro, 5,1 mm de error medio.
- Ninguna combinación de parámetros mejora de verdad: solo cambia cuánto detecta contra cuánto se equivoca. Tomando la mejor corrida de cada foto, el techo es 85 de 141 (60 %).
- Hipótesis (sin confirmar, de mirar dos fotos): lo que más pesa es la luz. A contraluz los agujeros se ven blancos sobre el negro y se detectan; con luz de frente se ven negros sobre negro y el algoritmo, que busca manchas de brillo distinto, no los ve. Las condiciones actuales no distinguen esto.
- Los agujeros pegados (27 % encontrados) necesitan un cambio en el algoritmo, no de parámetros.
- Al retomar: sumar las condiciones "A contraluz" / "Luz de frente" para confirmar la hipótesis; evaluar un consejo de cómo sacar la foto en la app y, en el algoritmo, detectar el borde roto del agujero y separar agujeros pegados.
- El set marcado está en `C:\Users\mmond\Downloads\blancos` (fotos, `dataset.json` y `resultados/`), fuera del repo.
