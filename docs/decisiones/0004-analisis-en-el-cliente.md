# ADR 0004 — Análisis de blancos en el cliente, sin librerías de visión

**Estado:** Aceptada · **Fecha:** 2026-10-28 · **Iteración:** 000 MVP

## Contexto
El análisis tiene que medir en mm sobre una foto sacada con el celular, detectar impactos y calcular puntaje, grupo, PMI y distancias (`shooting_metrics.md`). La app no tiene backend ([ADR 0001](./0001-firebase-desde-el-cliente.md)) y tiene que andar sin conexión.

## Decisión
Todo corre en el navegador con canvas y funciones puras en `src/lib/`:
- **Calibración manual asistida:** el usuario marca el centro y un punto sobre un anillo conocido (o dos puntos y su distancia en blancos sin zonas). El centro se propone solo en blancos de anillos. Una elipse opcional compensa fotos en ángulo (aproximación afín, sin corrección de perspectiva).
- **Detección automática que solo propone:** umbral adaptativo, erosión y componentes conexas con el tamaño de agujero según el calibre. El usuario siempre puede agregar, quitar y deshacer.
- **El usuario confirma el puntaje:** el análisis lo propone y "Usar el puntaje calculado" decide si reemplaza al manual.

## Consecuencias
- Sin dependencias pesadas (OpenCV.js pesa ~8 MB).
- La detección se probó solo con imágenes sintéticas; con fotos reales puede necesitar ajustes. El marcado manual es siempre el camino garantizado.
- Leer los píxeles de una foto guardada necesita CORS en el bucket (`cors.json`).
- La detección corre en el hilo principal (sin Web Worker).

## Alternativas descartadas
- **OpenCV.js:** demasiado peso para el MVP.
- **Procesar en Cloud Functions:** requiere backend y no anda sin conexión.
- **Exigir que la foto muestre todo el blanco:** la calibración con cualquier anillo visible lo evita.
