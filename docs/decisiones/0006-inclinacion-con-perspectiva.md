# ADR 0006 — Inclinación del blanco con perspectiva en la calibración

**Estado:** Aceptada · **Fecha:** 2026-10-29 · **Iteración:** 001 Fixes
**Reemplaza:** la "elipse opcional (aproximación afín, sin corrección de perspectiva)" del [ADR 0004](./0004-analisis-en-el-cliente.md).

## Contexto
En el MVP, una foto sacada en ángulo se compensaba con "Forma": los anillos se volvían elipses afines, todas con el mismo centro y el mismo aplastamiento, y arrastrar fijaba el radio en la dirección del dedo. El usuario reportó que eso "deforma mal" los círculos: en una foto real en ángulo, el lado cercano se ve más grande, los anillos dejan de ser concéntricos y el gesto tendría que sentirse como cambiar el ángulo desde el que se mira el blanco.

## Decisión
- **Modelo de cámara estenopeica.** El punto principal es el centro de la foto y la distancia focal se supone de 0,75 × el lado mayor (la cámara principal de un celular, ≈ 26 mm equivalentes). El blanco es un plano girado `|tilt|` radianes alrededor de un eje de la foto perpendicular a `tilt`; su centro cae sobre el marcador del centro. La transformación mm ↔ píxeles es una **homografía** (`src/lib/homography.ts`).
- **La escala sale del punto del anillo**, como antes: la homografía se escala para que ese punto quede sobre el anillo elegido. Los anillos siempre pasan por él.
- **Cada anillo se dibuja como la cónica proyectada** de su círculo (una elipse cuyo centro ya no es la imagen del centro del blanco). El grupo alrededor del PMI, igual.
- **Gesto "Inclinación":** arrastrar suma a la inclinación del inicio el desplazamiento del dedo (0,02 rad por cada 1 % del lado mayor), hasta 70°. El lado hacia el que se arrastra se acerca. "Quitar la inclinación" vuelve a círculos.
- **Se guarda `tilt: { x, y }`** en la calibración de la ronda. Las calibraciones viejas con `shape` se siguen leyendo con el modelo afín, así sus impactos quedan donde estaban; al volver a inclinar, `tilt` reemplaza a `shape`.
- `mmPerPixel` es la escala local en el centro del blanco (la raíz del determinante de la derivada de la homografía).

## Consecuencias
- Las fotos con ángulos moderados se pueden calibrar haciendo coincidir todos los anillos, no solo uno.
- Sin inclinación, la transformación es exactamente la de antes: no cambia ningún análisis guardado ni las métricas (ADR 0003).
- La focal es una suposición: con zoom, la perspectiva real es menor que la del modelo. El ajuste a ojo de la inclinación la compensa en buena parte, pero no del todo.
- La detección de impactos usa un único tamaño de agujero (el del centro); con perspectiva fuerte, los agujeros lejanos miden un poco distinto.
- El centro automático (`target-center.ts`) busca el centro de los anillos en la foto, que con perspectiva no coincide exactamente con el centro del blanco; el usuario puede corregirlo.
- Las reglas de Firestore no cambian: no recorren el contenido de las rondas (ADR 0002).

## Alternativas descartadas
- **Inclinación sin perspectiva (afín, solo aplastar):** más simple, pero no reproduce lo que se ve en una foto en ángulo, que era el pedido.
- **Convertir la forma vieja en inclinación al leerla:** movería los impactos guardados sobre la foto.
- **Marcar cuatro puntos para una homografía libre:** más preciso, pero pide puntos que el blanco no siempre tiene y es más lento que arrastrar.
- **Pedir la focal o el zoom al usuario:** un dato que el tirador no conoce; la foto no siempre trae EXIF (se quita al comprimirla).
