# ADR 0009 — Datos de MantisX por bookmarklet e importación de archivo

**Estado:** Aceptada · **Fecha:** 2026-11-16 · **Iteración:** 003 MantisX
**Mantiene:** el [ADR 0001](./0001-firebase-desde-el-cliente.md) (sin backend propio) y el [ADR 0002](./0002-rondas-embebidas.md) (rondas embebidas en la sesión).

## Contexto
El sensor MantisX registra, por cada disparo, el puntaje de la presión del gatillo, los tiempos, un diagnóstico y la trayectoria del arma. Esos datos están en train.mantisx.com, que no tiene una API pública: la web usa una API interna (`/session-history`, `/get-session`) autenticada con la cookie de sesión, el token CSRF y dos variables que define la página (`user_pk`, `user_sk`). El CSV oficial de MantisX no trae la trayectoria. Range Book no tiene backend y no debe guardar credenciales de terceros.

## Decisión
- **Un marcador (bookmarklet) "Exportar a Range Book"** que el usuario ejecuta en train.mantisx.com con su sesión iniciada. Pide un rango de fechas, baja las sesiones con la API interna (de a una por segundo) y descarga un JSON `{ source: 'mantisx', formatVersion: 1, exportedAt, range, sessions }` con las sesiones tal cual las devuelve MantisX. El código está en `src/lib/mantis-bookmarklet.ts` y la app lo ofrece con "Copiar el marcador" (React bloquea los links `javascript:`, así que no se puede arrastrar).
- **La importación es en el cliente** (`mantis-import.ts`): valida `source` y `formatVersion`, se queda con el fuego real de "Open Training" (`fire_type = 1`, `drill_id = 0`), descarta lo borrado y normaliza los tipos. Si algo no tiene el formato esperado, falla el archivo entero con un error claro (lo más probable es que MantisX haya cambiado su API).
- **Matching propuesto y editable** (`mantis-matching.ts`): la sesión de Range Book del mismo día (si hay varias, la del arma de MantisX) y, dentro, las rondas sin datos de MantisX, uno a uno, sin cruzar el orden y con la menor diferencia de hora. Para eso las rondas guardan la hora en que se crean (`createdAt`). Lo que no tiene ronda o sesión no se importa y se indica el motivo.
- **Dónde se guarda:** el resumen de cada sesión de MantisX (unos 1 KB por ronda: puntaje, split, diagnóstico, dirección, índices de movimiento e inclinación de cada disparo) va embebido en la ronda (`rounds[i].mantis`). La trayectoria (unos 33 KB por ronda) va en `users/{uid}/mantisTraces/{sessionPk}`, que se lee solo al verla. El id del documento es el de MantisX: reimportar no duplica, y una sesión ya vinculada se muestra como "Ya importada".
- Los valores derivados (tiempo total, promedios, extremos, trayectoria en mm) se calculan al mostrar; no se guardan.

## Consecuencias
- La contraseña y las cookies de MantisX nunca pasan por Range Book: el marcador corre en la página de MantisX y solo descarga un archivo.
- La API de MantisX no es oficial y puede cambiar. Lo ya importado no se ve afectado; se ajusta el marcador o el lector (`formatVersion` permite distinguir archivos nuevos: "actualizá Range Book").
- La importación funciona sin conexión (lee un archivo local y escribe en la caché de Firestore) y se sincroniza al volver.
- Las reglas validan `mantisTraces` (dueño, claves, `sampleRate`, hasta 150 disparos); el contenido de cada disparo y el resumen embebido los valida el cliente, como el resto de la ronda.
- Las trayectorias de rondas o sesiones eliminadas quedan huérfanas (las rondas se restauran tal cual con "Deshacer"). Son chicas y se pisan si se reimporta la misma sesión. "Quitar los datos de MantisX" sí borra la suya, cuando ya no se puede deshacer.
- La convención de `angle` (0° = derecha, antihorario) y los signos de `yaw` y `absolute_roll` se dedujeron de los datos de un tirador zurdo; la inclinación del arma se muestra sin lado.

## Alternativas descartadas
- **Cloud Function que llame a la API de MantisX:** requiere backend propio y guardar credenciales de MantisX, y Cloudflare puede bloquear las IPs de Google.
- **CSV oficial de MantisX:** no trae la trayectoria.
- **Todo embebido en la ronda:** unos 33 KB por ronda; una sesión de 30 rondas se acerca al límite de 1 MiB y la lista de sesiones cargaría todas las trayectorias.
- **Trayectorias en Storage:** las reglas de Storage solo aceptan imágenes, y Firestore ya tiene caché offline y reglas por dueño.
