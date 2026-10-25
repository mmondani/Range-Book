## Proyecto
[Range Book]: app web/mobile para llevar un registro de los entrenamientos en el polígono, con analítica de fotos de dianas.

## Convenciones
- Código y nombres en [inglés / castellano]; documentación en castellano.
- Componentes en PascalCase, funciones en camelCase, archivos en kebab-case.
- Un componente por archivo. Lógica de negocio fuera de los componentes, en `src/lib/`.
- No agregar dependencias nuevas sin mencionarlo en el plan.
- Cada feature nueva incluye tests de sus criterios de aceptación.

## Flujo de trabajo

### Antes de planificar
1. Leer `docs/vision.md` y `docs/arquitectura.md`.
2. Leer los ADR vigentes en `docs/decisiones/` si el cambio toca alguna decisión.
3. Leer `requerimientos.md` de la iteración actual en `docs/features/NNN-nombre/`.
4. No leer planes de iteraciones anteriores salvo que se pida explícitamente.

### Al planificar
- Escribir `plan.md` en la carpeta de la iteración usando `docs/plantillas/plan.md`.
- Si algo del requerimiento es ambiguo, listarlo en "Preguntas abiertas" y esperar respuesta antes de implementar.
- No implementar hasta que el plan esté aprobado.

### Al implementar
- Seguir el plan paso a paso y marcar cada checkbox al terminarlo.
- Correr tests y lint después de cada paso relevante.
- Si hay que desviarse del plan, anotarlo en `notas.md` con el motivo. No reescribir el plan.

### Al cerrar la iteración
1. Verificar todos los criterios de aceptación.
2. Actualizar `docs/arquitectura.md` para que refleje el estado real del sistema.
3. Si hubo una decisión de diseño importante, crear un ADR en `docs/decisiones/`.
4. Completar `notas.md` con pendientes y aprendizajes.

## Iteración actual
<!-- Actualizar al empezar cada iteración -->
