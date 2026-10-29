# Cambios de diseño — 001 Set de calibración

Maqueta: [maqueta/index.html](./maqueta/index.html).

## Pantallas modificadas

### M12 · Edición de blanco
- Solo al editar un blanco existente (no al crearlo), después de las zonas: campo **Calibración de la detección** con el botón secundario **Copiar para calibración** (ícono `Copy`) y la ayuda "Copia el nombre y las zonas guardadas del blanco para pegarlos en la herramienta de calibración".
- Copia al portapapeles la definición **guardada** del blanco (nombre, puntuación, medida de referencia y zonas), no lo que se está editando sin guardar.
- Al copiar: toast "Blanco copiado". Si el navegador no deja escribir en el portapapeles: toast de error "No se pudo copiar".
- En desktop es el mismo diálogo, sin cambios de layout.

## Pantallas nuevas
- Ninguna en la app. La herramienta de `calibration/` es de desarrollo, con interfaz mínima, y no forma parte de la maqueta ni de `pantallas.md`.

## Qué cambia en `docs/diseno/` al cerrar
- **`pantallas.md`:** en M12, el botón "Copiar para calibración" (solo en edición) y sus toasts.
- **`design-system.md`:** sin cambios (usa `Button` secundario, `Field` y `Toast` existentes).
- **Maqueta:** `mobile/blanco-form.html` suma el botón. Hoy la maqueta muestra el alta; se puede dejar el alta y agregar el botón con una nota de que solo aparece al editar.
