# ADR 0002 — Rondas embebidas en el documento de la sesión

**Estado:** Aceptada · **Fecha:** 2026-10-28 · **Iteración:** 000 MVP

## Contexto
Una sesión tiene varias rondas (blanco, distancia, disparos, puntaje, foto y análisis). Rendimiento necesita todas las rondas junto con los datos de su sesión (arma, munición, polígono, fecha).

## Decisión
Las rondas van en un array `rounds[]` dentro de `users/{uid}/sessions/{id}`, cada una con su propio `id` (UUID generado en el cliente). Para agregar, editar, analizar o eliminar una ronda se lee el array crudo con `getDoc`, se cambia y se escribe con `updateDoc`. **Sin transacción**, para que funcione sin conexión con la caché local; un solo usuario edita sus sesiones.

## Consecuencias
- Rendimiento y Sesiones leen todo con una sola suscripción, sin índices de *collection group*.
- Hay que reescribir el array crudo (no el parseado) para no perder los campos del análisis que la UI no lee.
- Límite de 100 rondas por sesión (en las reglas y en el cliente); una sesión queda muy lejos del límite de 1 MB por documento.
- Si una ronda se elimina desde otro dispositivo mientras su sheet está abierto, guardarla la vuelve a agregar.

## Alternativas descartadas
- **Subcolección `rounds`:** obliga a una consulta por sesión o a un *collection group*, que las reglas no pueden limitar al dueño sin guardar el `uid` en cada ronda.
