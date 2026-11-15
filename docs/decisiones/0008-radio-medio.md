# ADR 0008 — Radio medio en lugar de la distancia al centro

**Estado:** Aceptada · **Fecha:** 2026-11-15 · **Iteración:** 002 Upgrades
**Modifica:** el [ADR 0003](./0003-snapshots-del-historial.md) (excepción puntual al historial que no cambia) y la decisión del MVP que había quitado el radio medio del prototipo.

## Contexto
La métrica "Al centro" era la distancia media de cada impacto al **centro del blanco**. Mezclaba precisión (qué tan cerrado es el grupo) con exactitud (qué tan centrado está), y la exactitud ya la mide el desvío del PMI: un grupo cerrado pero corrido daba un valor alto. En la Evolución, además, su círculo se dibujaba centrado en el PMI con un radio medido desde el centro del blanco, una geometría que no representaba nada visible.

## Decisión
- **Radio medio** (*mean radius*): promedio de la distancia de cada impacto **a su PMI**. Con un impacto, 0; sin impactos, no hay.
- Cada métrica mide una sola cosa: PMI (exactitud), tamaño de grupo y radio medio (precisión; el radio medio usa todos los impactos, el grupo solo los dos más separados).
- **"Al centro" se borra** de la UI, del código y de los datos: `meanRadiusMm` reemplaza a `meanDistanceMm` en las métricas del análisis.
- **Se reprocesan todos los análisis guardados.** Es una excepción explícita al ADR 0003: no se recalcula por un cambio del inventario sino porque la métrica cambió de definición, y solo a partir de los impactos guardados en mm (no hacen falta la calibración ni el blanco). El resto del snapshot (puntaje, grupo, PMI) no se toca.
- **La migración corre en la app** (`useMetricsMigration` en `BackgroundTasks` → `SessionRepository.migrateMeanRadius`), una vez por usuario y por ejecución, después de iniciar sesión. Lee las sesiones y reescribe solo las que tienen rondas por migrar, sin transacción (como el resto de las escrituras, para que funcione sin conexión). Es idempotente.
- Mientras no corrió, `parseAnalysis` calcula el radio medio con los impactos e ignora `meanDistanceMm`.

## Consecuencias
- La tarjeta del análisis dice "Radio medio · Prom. al PMI" y la Evolución, PMI / Grupo / Radio medio, con un círculo de radio igual al radio medio alrededor de cada PMI.
- Un dispositivo con la versión vieja de la app puede volver a guardar `meanDistanceMm`; la próxima ejecución de la versión nueva lo migra.
- Si un usuario edita una sesión en otro dispositivo justo mientras corre la migración, la última escritura gana (el mismo riesgo que ya acepta el resto de las escrituras; un solo usuario edita sus sesiones).
- Las reglas de Firestore no cambian: no validan el contenido de las rondas (ADR 0002).

## Alternativas descartadas
- **Conservar las dos métricas:** cuatro tarjetas, y la distancia al centro no agrega información que no den el PMI y el radio medio.
- **Calcular el radio medio solo al leer, sin migrar:** dejaría `meanDistanceMm` en los datos, y se pidió borrarlo.
- **Script único con `firebase-admin`:** migra a todos los usuarios de una vez, pero suma una dependencia de desarrollo y una cuenta de servicio.
- **Migración con transacción:** falla sin conexión, a diferencia del resto de las escrituras de la app.
