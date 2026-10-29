## Proyecto
[Range Book]: app web/mobile para llevar un registro de los entrenamientos en el polígono, con analítica de fotos de dianas.

## Convenciones
- Código y nombres en inglés; textos de la UI y documentación en castellano.
- Componentes en PascalCase, funciones en camelCase, archivos en kebab-case.
- Un componente por archivo. Lógica de negocio fuera de los componentes, en `src/lib/`.
- No agregar dependencias nuevas sin mencionarlo en el plan.
- Cada feature nueva incluye tests de sus criterios de aceptación.

## Flujo de trabajo

### Antes de planificar
1. Leer `docs/vision.md` y `docs/arquitectura.md`.
2. Leer los ADR vigentes en `docs/decisiones/` si el cambio toca alguna decisión.
3. Leer `requerimientos.md` de la iteración actual en `docs/features/NNN-nombre/`.
4. Si el cambio toca la UI, leer `docs/diseno/` (README, `design-system.md`, `pantallas.md` y la maqueta).
5. No leer planes de iteraciones anteriores salvo que se pida explícitamente.

### Al planificar
- Escribir `plan.md` en la carpeta de la iteración usando `docs/plantillas/plan.md`.
- Si el cambio toca la UI, crear `diseno/` en la carpeta de la iteración con `cambios.md` y una maqueta con solo las pantallas nuevas o modificadas (formato en `docs/diseno/README.md`). No modificar `docs/diseno/` en esta etapa.
- Si algo del requerimiento es ambiguo, listarlo en "Preguntas abiertas" y esperar respuesta antes de implementar.
- No implementar hasta que el plan (y la maqueta de la iteración, si la hay) esté aprobado.

### Al implementar
- Usar como referencia visual la maqueta de la iteración para las pantallas que cambian, y `docs/diseno/maqueta/` para el resto.
- Seguir el plan paso a paso y marcar cada checkbox al terminarlo.
- Correr tests y lint después de cada paso relevante.
- Si hay que desviarse del plan, anotarlo en `notas.md` con el motivo. No reescribir el plan.

### Al cerrar la iteración
1. Verificar todos los criterios de aceptación.
2. Actualizar `docs/arquitectura.md` para que refleje el estado real del sistema.
3. Si la iteración cambió la UI, llevar los cambios a `docs/diseno/` (maqueta, `pantallas.md` y `design-system.md`) según lo que realmente se implementó. Anotar en `notas.md` los desvíos respecto de la maqueta aprobada.
4. Si hubo una decisión de diseño importante, crear un ADR en `docs/decisiones/`.
5. Completar `notas.md` con pendientes y aprendizajes.

## Iteración actual
<!-- Actualizar al empezar cada iteración -->
001 — Set de calibración de la detección: `docs/features/001-set-de-calibracion/`. Herramienta de desarrollo en `calibration/` (fuera de `src/`, no se despliega) para marcar fotos reales de blancos y evaluar contra ellas la detección de impactos y del centro.
