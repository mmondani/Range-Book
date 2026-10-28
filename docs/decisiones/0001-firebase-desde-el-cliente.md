# ADR 0001 — Firebase directo desde el cliente, sin backend propio

**Estado:** Aceptada · **Fecha:** 2026-10-28 · **Iteración:** 000 MVP

## Contexto
La visión fija Firebase (Hosting, Firestore, Storage y Authentication). Cada usuario solo puede ver sus datos y solo pueden entrar los emails autorizados. Los usuarios son pocos y los volúmenes, chicos (un tirador, decenas de sesiones por año).

## Decisión
La SPA usa el SDK de Firebase directamente. No hay Cloud Functions ni API propia. La privacidad la garantizan las reglas de Firestore y Storage: todo vive bajo `users/{uid}`, y solo lo lee y escribe su dueño si su email está en `allowedEmails`. Las reglas también validan campos, tipos y límites de cada documento.

## Consecuencias
- Sin servidor que mantener; el despliegue es `firebase deploy` de hosting, reglas e índices.
- Las reglas son críticas: tienen tests propios contra el emulador (`tests/rules/`).
- Las reglas no recorren listas: el contenido de las rondas, las zonas y las personalizaciones lo valida solo el cliente.
- Las agregaciones (Rendimiento, tiros acumulados) se calculan en el cliente sobre la colección completa del usuario.
- Storage consulta Firestore desde sus reglas; la cuenta de servicio de Storage necesita el rol `firebaserules.firestoreServiceAgent`.

## Alternativas descartadas
- **Cloud Functions para validar o agregar:** las reglas alcanzan para la privacidad y las agregaciones son chicas.
- **Pantalla de administración de emails:** se cargan a mano desde la consola.
