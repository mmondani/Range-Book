# ADR 0003 — Snapshots para que el historial no cambie

**Estado:** Aceptada · **Fecha:** 2026-10-28 · **Iteración:** 000 MVP

## Contexto
El inventario cambia con el tiempo: se editan las modificaciones del arma, se corrigen las zonas de un blanco. El historial de sesiones tiene que seguir mostrando lo que pasó.

## Decisión
- Al guardar una sesión se copian las personalizaciones del arma (`modificationsSnapshot: {brand, model}[]`).
- Al guardar un análisis se guardan los impactos en mm **y** un snapshot completo de las métricas (puntaje, distribución, grupo en mm y MOA, PMI, distancia media), además de la calibración.
- El inventario nunca se borra: se archiva. Un archivado deja de ofrecerse para lo nuevo, pero el historial lo sigue mostrando y se puede restaurar.

## Consecuencias
- Editar un blanco no recalcula análisis viejos; para recalcular hay que reabrir el análisis y guardarlo.
- Las sesiones y Rendimiento leen las métricas guardadas sin recalcular.
- Si una ronda analizada cambia de foto o de blanco, su análisis se descarta al guardar (se hizo sobre otra foto u otro blanco).

## Alternativas descartadas
- **Guardar solo los impactos y recalcular siempre:** si cambia el blanco, cambiaría el historial.
- **Referenciar las modificaciones por id:** una edición posterior alteraría sesiones pasadas.
