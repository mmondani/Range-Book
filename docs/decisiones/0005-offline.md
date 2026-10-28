# ADR 0005 — Uso sin conexión

**Estado:** Aceptada · **Fecha:** 2026-10-28 · **Iteración:** 000 MVP

## Contexto
La app se usa en el polígono, a menudo con mala señal o sin ella. Tiene que poder cargar sesiones, rondas y fotos, y sincronizar después.

## Decisión
- **Firestore con caché persistente** (`persistentLocalCache` en IndexedDB, varias pestañas): las lecturas salen de la caché y las escrituras quedan en cola.
- **`settleWrite`:** la promesa de una escritura recién resuelve con la confirmación del servidor, así que se da por guardada al instante si no hay conexión, o a los 4 s si el servidor no responde. Con conexión normal se espera, así los errores se ven.
- **Cola de fotos propia** (`upload-queue.ts` + IndexedDB), porque Storage no tiene cola offline: toda foto se guarda primero en el dispositivo y se intenta subir; si no se puede, el documento ya guarda su ruta y la foto se sube al abrir la app o al volver la conexión. Mientras tanto se muestra y se analiza desde el dispositivo. Si Storage la rechaza, sale de la cola y el formulario avisa.
- **Service worker** (`vite-plugin-pwa`): la app precacheada, Google Fonts y fotos de Storage en caché. Las versiones nuevas se ofrecen con un aviso y no recargan solas, para no cortar un formulario.

## Consecuencias
- Un error que llega después de dar una escritura por guardada solo se registra en la consola.
- Las fotos borradas sin conexión no se eliminan de Storage (quedan huérfanas).
- Las operaciones sobre rondas no usan transacciones ([ADR 0002](./0002-rondas-embebidas.md)).
- El primer ingreso necesita conexión (login y autorización).

## Alternativas descartadas
- **Esperar siempre la confirmación del servidor:** sin conexión los formularios quedan en "guardando".
- **No esperar nunca:** se perderían los errores de permisos con conexión normal.
- **`workbox-background-sync` para las fotos:** las subidas de Storage usan su propio protocolo; una cola propia permite además mostrar y analizar la foto pendiente.
