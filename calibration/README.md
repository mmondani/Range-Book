# Calibración de la detección

Herramienta de desarrollo para armar un set de fotos reales de blancos con la "verdad" marcada a mano y evaluar contra él la detección automática de impactos (`src/lib/impact-detection.ts`) y del centro (`src/lib/target-center.ts`). No se despliega ni entra en el build de la app.

## Abrirla

```
pnpm calibration
```

Abre `http://localhost:5174`. Funciona solo en **Chrome** de escritorio (usa la API de acceso a archivos para leer y escribir la carpeta del set).

## La carpeta del set

- Al abrir la herramienta se elige una carpeta: conviene `calibration/dataset/`, que está en `.gitignore` (las fotos y los datos no se versionan).
- En la carpeta quedan las fotos, `dataset.json` (lo marcado) y `resultados/` (las evaluaciones).
- Cada cambio se guarda solo en `dataset.json`. Al recargar, "Seguir con «carpeta»" la vuelve a abrir (Chrome pide permiso con un clic).
- Las imágenes que se copian a mano en la carpeta aparecen solas, sin marcar, la próxima vez que se abre. Las que se agregan con el botón o arrastrándolas se copian a la carpeta.

## Marcar una foto

1. **Blanco:** en la app, Inventario → blanco → "Copiar para calibración"; en la herramienta, "Pegar blanco copiado de la app" (o pegarlo en el campo). Elegirlo en "Blanco".
2. **Datos:** calibre, disparos de la ronda, condiciones de la foto y notas.
3. **Calibrar:** igual que en el análisis de la app (centro y un anillo, o dos puntos y su distancia; "Forma" para fotos en ángulo). El centro marcado también es la "verdad" del centro.
4. **Agregar:** tocar el centro de cada agujero de papel roto, no el anillo gris de plomo. Si varios se superponen, uno por bala. Con zoom (Ctrl + rueda o los botones) para precisión.
5. **Etiquetar:** tocar un impacto y marcar si está pegado o superpuesto, fuera del anillo exterior o es de otra ronda.
6. **Marcar como lista** cuando está revisada. Solo las listas entran en la evaluación.

"Ver la detección actual" muestra lo que propone la app (marcado con «D») sin mezclarlo con lo marcado. "Usar como punto de partida" lo copia, pero hay que revisar cada impacto.

Atajos: Página siguiente / anterior cambian de foto; Ctrl + Z deshace.

## Evaluar

En **Evaluar**, con los parámetros de la app o con otros, se corre la detección sobre las fotos listas, por el mismo camino que en la app (compresión a 2000 px, reducción y detección). Informa, para el set, por foto, por etiqueta y por condición:

- **Encontrados:** impactos marcados con una detección a menos de medio agujero.
- **Correctas:** detecciones que corresponden a un impacto marcado.
- **Error medio y máximo** de los encontrados, en mm.
- **Centro:** error medio del centro detectado, en mm, y en cuántas fotos no propuso centro.

El resultado se imprime en la consola del navegador y se guarda en `resultados/AAAA-MM-DD-HHMMSS.json`, con los parámetros usados, para comparar corridas.

## Formato de `dataset.json` (versión 1)

```
{ version: 1,
  targets: [{ id, name, scoring, referenceSizeMm, zones[{ score, diameterMm }] }],
  photos:  [{ file, width, height, status, caliber, targetId, shots, calibration,
              impacts[{ x, y, tags }], conditions, notes }] }
```

Las coordenadas (calibración e impactos) están en píxeles de la foto original, con la orientación EXIF aplicada.
