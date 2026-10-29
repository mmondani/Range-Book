# Objetivo
- La detección automática de impactos (`src/lib/impact-detection.ts`) y del centro (`src/lib/target-center.ts`) solo se probó con imágenes sintéticas. Para ajustarla hace falta un set de fotos reales con la "verdad" marcada a mano.
- Esta iteración arma una mini web para marcar ese set (cargar varias fotos, marcar en cada una el centro, la escala y los impactos, y exportar los datos) y un script que evalúa la detección actual contra el set.
- Es una herramienta de desarrollo. La app solo cambia en lo necesario para copiar la definición de los blancos (ver "Blancos").

# Ubicación
- Vive en una carpeta propia para la calibración de la detección, en la raíz del repo (`calibration/`), separada de `src/`.
- Se abre en local con un comando de pnpm (por ejemplo `pnpm calibration`). No se despliega, no forma parte de la PWA y no necesita login ni Firebase.
- Reusa la lógica de `src/lib/` que ya existe (calibración, zonas del blanco, zoom) en lugar de duplicarla.
- Pensada para usarse en una PC (mouse y teclado). No hace falta que ande en el celular.
- Interfaz mínima: funcional y legible, sin seguir el sistema de diseño de la app ni necesitar maqueta.
- Las fotos y el `dataset.json` del set van en una carpeta dentro de `calibration/` excluida del repo (`.gitignore`). No se versionan.

# Carga de fotos
- Se pueden cargar varias fotos a la vez, eligiéndolas del sistema de archivos o arrastrándolas.
- Se muestra la lista de fotos cargadas con su estado: sin marcar, en progreso o lista.
- Se puede pasar de una foto a otra (también con el teclado) sin perder lo marcado.
- Se puede quitar una foto del set.
- Las fotos se ven con la misma orientación que usa la app al leerlas (la rotación EXIF de las fotos del celular ya aplicada), para que las coordenadas coincidan.

# Datos de cada foto
- Calibre del arma (texto libre, como en el inventario: `9×19 mm`, `.22 LR`, etc.).
- Blanco: uno de los blancos copiados desde la app (ver "Blancos").
- Cantidad de disparos de la ronda (para controlar que los impactos marcados coincidan).
- Condiciones de la foto: luz pareja, sombra, flash, en ángulo, borrosa, papel con agujeros viejos (se puede elegir más de una).
- Notas libres.

# Blancos
- La definición de los blancos (nombre, tipo de puntuación y zonas: puntaje y diámetro en mm de cada anillo) se copia desde el inventario de la app, no se carga a mano en la herramienta.
- Un blanco copiado queda disponible para todas las fotos del set.

# Calibración
- Igual que en la app: en blancos con anillos, el centro y un punto sobre un anillo conocido; en blancos sin zonas, dos puntos y la distancia entre ellos en mm.
- En blancos con anillos se puede deformar los anillos para fotos en ángulo (la misma "Forma" de la app).
- Los anillos calibrados se dibujan sobre la foto para verificar que coinciden.
- El centro marcado es también la "verdad" para evaluar la detección automática del centro.

# Marcado de impactos
- Modos agregar y quitar, como en la app, y deshacer.
- Zoom y desplazamiento dentro de la foto (rueda, botones y teclado), porque los impactos se marcan con zoom.
- Se marca el centro del agujero de papel roto, no el anillo gris de plomo alrededor.
- Si varios agujeros se superponen, se marca un punto por bala.
- Cada impacto puede tener etiquetas: pegado o superpuesto con otro, fuera del anillo exterior, de otra ronda (agujero viejo).
- Se muestra cuántos impactos hay marcados y se avisa si no coinciden con los disparos declarados.
- Se puede ver, como referencia, lo que propone la detección automática actual sobre la foto. No se mezcla con lo marcado a mano salvo que el usuario lo pida (y cada impacto propuesto se revisa).
- Una foto se marca como "lista" a mano, cuando el usuario terminó de revisarla.

# Guardado y exportación
- El progreso se conserva si se cierra o recarga la página.
- Se exporta un único archivo `dataset.json` con todas las fotos, que se guarda junto a las fotos. Cada foto se identifica por su nombre de archivo.
- Por cada foto se exporta: nombre de archivo, tamaño en píxeles, calibre, blanco, disparos, calibración, impactos (en píxeles de la foto original, con sus etiquetas), condiciones, notas y estado.
- Las coordenadas van en píxeles de la foto original (sin reducir), así no dependen de la escala a la que trabaje la detección.
- El formato lleva un número de versión para poder cambiarlo más adelante.
- Se puede importar un `dataset.json` con sus fotos para seguir marcando o corregir un set ya exportado.

# Evaluación de la detección
- Un script (por ejemplo `pnpm calibration:eval`) lee el `dataset.json` y sus fotos, corre la detección actual de impactos y del centro sobre cada foto "lista" y la compara con lo marcado a mano.
- La detección corre igual que en la app: con el calibre, la calibración y las zonas de la foto, y la foto reducida a la misma escala.
- Una detección cuenta como correcta si cae a menos de medio diámetro de agujero de un impacto marcado; cada impacto marcado se empareja con una sola detección.
- Informa, para el set completo, por foto, por etiqueta del impacto y por condición de la foto:
    - impactos encontrados: marcados que se detectaron / total marcados
    - detecciones correctas: detecciones que corresponden a un impacto / total detectado
    - error de posición de los impactos encontrados, en mm
    - error del centro detectado, en mm (en blancos con anillos), o si no propuso centro
- Se pueden cambiar los parámetros de la detección (umbral, filtros de tamaño y forma) al correrlo, para comparar variantes sin tocar el código de la app.
- El resultado se ve en la consola y se puede guardar en un archivo, para comparar una corrida con otra.

# Criterios de aceptación
- Se cargan varias fotos a la vez y se ven en la lista con su estado.
- En una foto se calibra (con anillos y sin zonas), se marcan impactos con etiquetas, se quitan y se deshace.
- Al recargar la página, lo marcado sigue ahí.
- El `dataset.json` exportado tiene todos los datos de cada foto y las coordenadas en píxeles de la foto original.
- Al importar ese `dataset.json` con las mismas fotos, todo queda como estaba.
- Una foto con rotación EXIF queda con las marcas en el mismo lugar que en la app.
- `pnpm build` de la app no incluye la herramienta.
- Un blanco del inventario de la app se copia a la herramienta sin cargar sus zonas a mano.
- Las fotos y el `dataset.json` del set no aparecen en `git status`.
- El script de evaluación, sobre un set de prueba con resultados conocidos (por ejemplo, imágenes sintéticas), informa los valores esperados de cada métrica.
- Con otros parámetros de detección, el script informa resultados distintos sin cambios en `src/lib/`.

# Preguntas resueltas
- Fotos del set: en una carpeta excluida del repo (tampoco se versiona el `dataset.json`).
- Script de evaluación: entra en esta iteración.
- Interfaz: mínima, sin sistema de diseño ni maqueta.
- Blancos: se copian desde la app. El mecanismo (por ejemplo, una acción en el blanco del inventario que copia su definición al portapapeles) se define en el plan.
