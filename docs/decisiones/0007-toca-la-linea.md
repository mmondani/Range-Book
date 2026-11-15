# ADR 0007 — Regla de "toca la línea" en el puntaje

**Estado:** Aceptada · **Fecha:** 2026-11-15 · **Iteración:** 002 Upgrades
**Reemplaza:** la decisión del MVP de puntuar por el centro del impacto, sin el diámetro del proyectil (`docs/diseno/pantallas.md` → Decisiones tomadas).

## Contexto
En el MVP, un impacto valía el puntaje de la zona más chica que contenía **su centro**. Así, un agujero cuyo borde corta la línea de un anillo sumaba el valor de afuera. El reglamento de tiro (y lo que el tirador espera) es el contrario: si el agujero toca la línea, cuenta el valor superior. El usuario lo pidió en la iteración 002.

## Decisión
- Un impacto vale el puntaje de la zona más chica cuyo círculo **toca el agujero**: `distancia del centro del impacto − Ø/2 ≤ radio de la zona`. Justo tangente cuenta adentro.
- **El diámetro sale del calibre del arma** de la sesión (`holeDiameterMm`, el mismo que usa la detección): `9×19 mm` → 9 mm, `.22 LR` → 5,6 mm, `.45 ACP` → 11,4 mm. Si no se reconoce, 9 mm.
- La regla vale para el puntaje, la distribución por zona, la zona de la tabla de impactos y la etiqueta accesible de cada impacto.
- `zoneScore`, `scoreDistribution`, `analysisMetrics` y `analysisResult` reciben el diámetro como último parámetro opcional; sin él (0), puntúan por el centro, como antes.
- **El diámetro no se guarda** en el análisis.

## Consecuencias
- Los análisis guardados **conservan su puntaje** (snapshot, [ADR 0003](./0003-snapshots-del-historial.md)): la regla se aplica al guardar un análisis nuevo o al reabrir y guardar uno viejo.
- Si se cambia el calibre del arma, el puntaje de un análisis viejo cambia recién al reabrirlo y guardarlo.
- Con un calibre que no se reconoce, se usa 9 mm: un .22 mal escrito puntuaría un poco a favor.
- Con perspectiva fuerte (ADR 0006), el agujero se toma del mismo tamaño en todo el blanco.

## Alternativas descartadas
- **Guardar el diámetro en el análisis:** no hace falta para leer el snapshot y obligaría a migrar los viejos. Se puede agregar si se quiere recalcular sin el arma.
- **Recalcular el puntaje de los análisis guardados al leerlos:** rompe el ADR 0003 (el historial no cambia solo).
- **Medir el agujero de cada impacto en la foto:** más preciso con agujeros rasgados, pero la detección no siempre encuentra el borde y los impactos marcados a mano no tienen tamaño.
