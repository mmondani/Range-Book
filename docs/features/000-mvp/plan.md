# Plan — 000 MVP

**Estado:** Aprobado
**Requerimientos:** [./requerimientos.md](./requerimientos.md)
**Diseño:** [design-system.md](./diseno/design-system.md) · [pantallas.md](./diseno/pantallas.md) · [maqueta](./diseno/maqueta/index.html)

## Resumen del enfoque
Se construye una SPA con **React + Vite + TypeScript**, instalable como PWA, desplegada en Firebase Hosting y que usa Firestore, Storage y Authentication (Google) directamente desde el cliente. Las reglas de seguridad de Firestore y Storage son la única barrera de privacidad: cada usuario solo lee y escribe bajo `users/{uid}`, y solo si su email figura en `allowedEmails`. Toda la lógica de negocio (métricas de tiro, puntaje por zonas, validación de blancos, snapshots, tiros acumulados, agregaciones de Rendimiento, calibración y detección de impactos) vive en `src/lib/` como funciones puras con tests. Los componentes solo orquestan datos y UI. El trabajo avanza por capas: base del proyecto → auth → inventario → sesiones y rondas → análisis → rendimiento → PWA/offline, y cada paso deja la app desplegable.

## Impacto en la arquitectura
No hay código todavía; todo es nuevo. `docs/arquitectura.md` no existe y se crea al cerrar la iteración.

- **Nuevo:**
  - App React (`src/`) con rutas según `pantallas.md`, layout responsive (barra inferior < 1024 px, sidebar ≥ 1024 px) y tokens de `design-system.md` en `src/styles/tokens.css`.
  - Capa de datos `src/data/` (repositorios por entidad sobre el SDK de Firebase) y hooks de suscripción en `src/hooks/`.
  - Lógica pura en `src/lib/`.
  - Configuración de Firebase: `firebase.json`, `firestore.rules`, `storage.rules`, `firestore.indexes.json`, emuladores para desarrollo y tests.
- **Modelo de datos (Firestore):**
  - `allowedEmails/{email}` → `{}`. Se administra a mano desde la consola; el cliente solo puede leer su propio email.
  - `users/{uid}` → perfil: `displayName`, `photoURL`, `units: 'mm' | 'in'`, `theme: 'dark' | 'light' | 'system'`.
  - `users/{uid}/firearms/{id}` → `brand`, `model`, `caliber`, `purchaseDate?`, `purchasePlace?`, `priorShots`, `photos: StoragePath[]`, `archived`.
  - `users/{uid}/firearms/{id}/modifications/{id}` → `brand`, `model`, `comments`, `archived`.
  - `users/{uid}/configurations/{id}` → `name`, `firearmId`, `modificationIds[]`, `archived`. La configuración "Stock" de cada arma es implícita (arma sin modificaciones), no un documento.
  - `users/{uid}/ammunition/{id}` → `brand`, `model`, `description`, `archived`.
  - `users/{uid}/ranges/{id}` → `name`, `address`, `archived`.
  - `users/{uid}/targets/{id}` → `name`, `photo?`, `scoring: 'rings' | 'none'`, `referenceSizeMm`, `zones: {score, diameterMm}[]`, `archived`.
  - `users/{uid}/sessions/{id}` → `date`, `firearmId`, `configurationId | null`, `modificationsSnapshot: {brand, model}[]`, `rangeId`, `weather`, `ammunitionId`, `photos[]`, `notes`, y **`rounds[]` embebidas**: `{id, targetId, distanceM, shots, manualScore?, score?, photo?, comments, analysis?}`. `analysis` = `{calibration, impacts: {x, y}[] (mm desde el centro), metrics, scoreConfirmed}`.
- **Storage:** `users/{uid}/{firearms|sessions|rounds|targets}/{docId}/{photoId}.jpg`; las reglas exigen `request.auth.uid == uid` y email autorizado.
- **Sin cambios pero relevante:** `.gitignore` ya contempla Vite y Firebase.

## Archivos
| Archivo | Acción | Motivo |
|---|---|---|
| `package.json`, `tsconfig*.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc`, `.env.example`, `index.html` | crear | Base del proyecto, lint, PWA, config de Firebase por variables de entorno |
| `firebase.json`, `.firebaserc`, `firestore.rules`, `storage.rules`, `firestore.indexes.json` | crear | Hosting, reglas, índices y emuladores |
| `src/main.tsx`, `src/app.tsx`, `src/routes.tsx` | crear | Entrada, providers y rutas |
| `src/styles/tokens.css`, `src/styles/base.css` | crear | Tokens de los dos temas, tipografía, foco, reduced-motion |
| `src/components/*.tsx` (+ `*.module.css`) | crear | Componentes de `design-system.md` → Componentes (uno por archivo) |
| `src/screens/**/*.tsx` | crear | Una pantalla por ruta (M01–M12 / W01–W07) |
| `src/data/firebase.ts`, `src/data/*-repository.ts` | crear | Inicialización de Firebase y acceso a cada colección |
| `src/hooks/*.ts` | crear | `useAuth`, `useCollection`, `useTheme`, `useUnits`, `useOnline`, etc. |
| `src/lib/metrics.ts` | crear | Puntaje, distribución, tamaño de grupo (mm/MOA), PMI (mm + horas de reloj), distancia al centro |
| `src/lib/target-zones.ts` | crear | Validación de zonas, generar anillos uniformes, zona de un impacto |
| `src/lib/calibration.ts` | crear | Escala y conversión píxeles ↔ mm a partir de la calibración (anillo de referencia o dos puntos con distancia), anillo visible sugerido |
| `src/lib/impact-detection.ts` | crear | Detección automática de impactos sobre `ImageData` |
| `src/lib/sessions.ts` | crear | Snapshot de personalizaciones, totales de sesión, defaults (último polígono, última munición por arma, ronda anterior) |
| `src/lib/firearms.ts` | crear | Tiros acumulados, configuraciones (incluida "Stock"), filtrado de archivados |
| `src/lib/performance.ts` | crear | Filtros, KPIs con delta vs. período anterior, series por sesión, comparación por munición, CSV |
| `src/lib/format.ts`, `src/lib/units.ts` | crear | Formato `es-AR`, mm ↔ pulgadas |
| `src/lib/image-compression.ts` | crear | Redimensionar a 2000 px y comprimir a JPEG 80 % con canvas |
| `src/lib/upload-queue.ts` | crear | Cola de subidas pendientes en IndexedDB para cuando no hay conexión |
| `src/lib/*.test.ts` | crear | Tests unitarios de toda la lógica |
| `src/screens/**/*.test.tsx` | crear | Tests de criterios de aceptación de las pantallas (con repositorios simulados) |
| `tests/rules/*.test.ts` | crear | Tests de reglas de Firestore y Storage contra el emulador |
| `public/icons/*` | crear | Íconos PWA con la diana naranja |
| `docs/arquitectura.md`, `docs/decisiones/*.md`, `docs/features/000-mvp/notas.md` | crear | Cierre de la iteración |

## Dependencias nuevas
**Producción**
- `react`, `react-dom` (19) → UI.
- `react-router` (7) → rutas, incluidas las de sheets y diálogos (el botón "atrás" los cierra).
- `firebase` (12) → Auth, Firestore (con persistencia offline), Storage.
- `lucide-react` → íconos, como pide `design-system.md`.

**Desarrollo**
- `vite`, `@vitejs/plugin-react`, `typescript` → build.
- `vite-plugin-pwa` → manifest y service worker (Workbox).
- `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` → tests.
- `@firebase/rules-unit-testing`, `firebase-tools` → emuladores y tests de reglas (Java 21 ya está instalado).
- `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `prettier` → lint y formato.

**Sin librería** (se hace a mano):
- Gráficos (`LineChart`, `BarChart`): SVG propio. Son dos tipos simples y así respetamos tokens, temas y accesibilidad sin pelear con una librería.
- Compresión de imágenes y detección de impactos: canvas. OpenCV.js pesa ~8 MB y no lo justifica para el MVP.
- Estado global: React context + suscripciones de Firestore (`onSnapshot`). No hace falta Redux/Zustand/React Query.

## Pasos
- [x] **1. Base del proyecto**
  - Qué: Vite + React + TS con pnpm, ESLint, Prettier, Vitest, alias `@/`. Scripts `dev`, `build`, `lint`, `test`, `test:rules`, `emulators`. `firebase.json` con Hosting (SPA rewrite) y emuladores.
  - Verificación: `pnpm build`, `pnpm lint` y `pnpm test` pasan; `pnpm dev` muestra una página vacía.
- [ ] **2. Tokens, tema y componentes base**
  - Qué: `tokens.css` (oscuro y claro), fuentes Barlow / Barlow Condensed, script inline en `index.html` que aplica `data-theme` antes del render, `useTheme`. Componentes: `Button`, `IconButton`, `Chip`, `Badge`, `Card`, `StatTile`, `Field`, `Input`/`Select`/`Textarea`/`DateInput`, `Stepper`, `SegmentedControl`, `Tabs`, `BottomSheet`/`Dialog`, `ConfirmDialog`, `Toast`, `EmptyState`, `Skeleton`. Layout con barra inferior y sidebar.
  - Verificación: tests de componentes (estados `loading`/`disabled`, `aria-*`, cierre del sheet con Escape y confirmación con cambios); revisión visual contra la maqueta en los dos temas.
- [ ] **3. Login y autorización**
  - Qué: Login con Google (popup en desktop, redirect en mobile PWA). Tras autenticar, se lee `allowedEmails/{email}`; si no existe, `signOut` y alerta "no autorizado". Guard de rutas. Creación del perfil en el primer ingreso. Reglas de Firestore y Storage con `isAllowed()` y dueño.
  - Verificación: tests de reglas (usuario no autorizado no lee nada; usuario A no lee datos de B; nadie escribe `allowedEmails`); tests de pantalla de los estados inicial, cargando, no autorizado y error de red.
- [ ] **4. Perfil**
  - Qué: M11 con avatar, resumen, unidades (mm / pulgadas), tema (Oscuro / Claro / Sistema, guardado en Firestore y `localStorage`), versión y cerrar sesión. "Instalar" se agrega en el paso 13.
  - Verificación: tests de `units.ts`; tests de que el tema se aplica al instante y persiste; cerrar sesión vuelve a `/login`.
- [ ] **5. Fotos**
  - Qué: `PhotoPicker` (cámara / galería / arrastrar), `PhotoGallery`, `image-compression.ts`, subida a Storage y guardado de la ruta en Firestore.
  - Verificación: test de cálculo de dimensiones de la compresión; test de que solo se guarda la ruta; prueba manual de cámara en el celular.
- [ ] **6. Inventario: municiones, polígonos y archivado**
  - Qué: M08/W06 con categorías y contadores; ABM de munición y polígonos en sheet/diálogo; archivar, "Ver archivadas" y restaurar (patrón común para todas las entidades).
  - Verificación: tests de que un archivado no aparece en listas ni selects pero sí con "Ver archivadas", y que se puede restaurar.
- [ ] **7. Inventario: armas, modificaciones y configuraciones**
  - Qué: M09/W07, M10. Fotos múltiples con portada, calibre con sugerencias, tiros previos. Modificaciones en sheet. Configuraciones (nombre + checkboxes de modificaciones). Tiros acumulados = previos + disparos de sesiones.
  - Verificación: tests de `firearms.ts` (tiros acumulados, configuración "Stock" implícita, archivados); tests de validación del formulario de arma.
- [ ] **8. Inventario: blancos**
  - Qué: M12 con tipo de puntuación, tamaño de referencia, `ZoneEditor` con "Generar" y vista previa.
  - Verificación: tests de `target-zones.ts` (diámetros únicos y crecientes al bajar el puntaje, ninguna zona mayor que la referencia, generación uniforme, zona más chica que contiene el centro, 0 fuera).
- [ ] **9. Sesiones: lista, alta, edición y detalle**
  - Qué: M02/W02 (resumen del mes, agrupado por mes, "Hoy", búsqueda y filtro por arma, estados vacío/cargando/sin resultados), M04/W03 (defaults, snapshot de personalizaciones, validación al salir del campo, foco en el primer error, confirmación al cerrar con cambios, borrador en `localStorage`), M03 (galería, totales, notas, eliminar con confirmación y "Deshacer").
  - Verificación: tests de `sessions.ts` (snapshot inmune a cambios posteriores del inventario, defaults, totales); tests de pantalla del formulario y de eliminar/deshacer.
- [ ] **10. Rondas**
  - Qué: M05 como sheet con URL propia (diálogo en desktop): blanco, distancia y disparos precargados de la ronda anterior, puntaje manual, foto, comentarios. `RoundRow` con estado *Analizada / Sin analizar*.
  - Verificación: tests de defaults de la ronda; test de que "atrás" cierra el sheet.
- [ ] **11. Análisis de blancos**
  - Qué: M06/W04. Calibración de la foto (centro + anillo visible elegido de la lista, o centro + dos puntos con distancia en mm en blancos sin zonas; anillos calibrados dibujados para verificar), `TargetAnalyzer` con modos Detectar / Agregar / Quitar, Deshacer con historial, PMI (cruz azul) y grupo (círculo punteado), aviso de impactos ≠ disparos, tabla de impactos en desktop, `MetricTile`s en vivo, checkbox "Usar el puntaje calculado". Estados: detectando, detección fallida, sin foto, blanco sin zonas. Se guardan impactos en mm y un snapshot de las métricas.
  - Verificación: tests de `metrics.ts` con casos calculados a mano (incluido MOA a varias distancias y horas de reloj del PMI), de `calibration.ts` (escala con distintos anillos de referencia y con dos puntos + distancia) y de `impact-detection.ts` con imágenes sintéticas; tests de pantalla de la confirmación del puntaje (marcado → usa el calculado; desmarcado → conserva el manual).
- [ ] **12. Rendimiento**
  - Qué: M07/W05 con filtros en la query string (configuración, munición, blanco, distancia, polígono, período), KPIs con delta, gráficos de puntaje promedio y tamaño de grupo por sesión (filtro por la distancia más usada por defecto), comparación por munición (mobile), tabla ordenable + CSV (desktop). Estados sin análisis y pocos datos.
  - Verificación: tests de `performance.ts` (filtros, deltas vs. período anterior, distancia por defecto, CSV).
- [ ] **13. PWA y offline**
  - Qué: manifest, íconos, service worker, `theme-color` según tema, botón "Instalar" (con `beforeinstallprompt`; instrucciones en iOS), persistencia offline de Firestore, banner "Sin conexión", cola de fotos pendientes.
  - Verificación: Lighthouse PWA instalable; prueba manual en modo avión: crear una sesión con foto y ver que se sincroniza al volver la conexión; test de `upload-queue.ts`.
- [ ] **14. Deploy y cierre**
  - Qué: crear el proyecto de Firebase (plan Blaze, app web, Auth con Google, Firestore, Storage) y cargar el primer email autorizado; deploy de reglas, índices y hosting. Verificación de criterios, `docs/arquitectura.md`, ADRs y `notas.md`.
  - Verificación: app accesible en la URL de Hosting desde el celular y la PC.

## Cobertura de criterios de aceptación
`requerimientos.md` no tiene una lista explícita de criterios; se toman sus enunciados como criterios.

| Criterio | Paso(s) | Cómo se verifica |
|---|---|---|
| Web usable en celular y PC; PWA en celular | 2, 13 | Revisión en 375 px y 1280 px; Lighthouse PWA |
| Login con Google y solo emails autorizados | 3 | Tests de reglas y de la pantalla de login |
| Cada usuario solo ve sus datos | 3, 5 | Tests de reglas de Firestore y Storage |
| Fotos en Storage, referencia en Firestore | 5 | Test de repositorio + revisión en el emulador |
| Perfil: unidades, tema (oscuro por defecto) y cerrar sesión | 4 | Tests de `units.ts` y `useTheme`, test de pantalla |
| ABM con archivado y restauración | 6, 7, 8 | Tests de pantalla del patrón de archivado |
| Armas, modificaciones y configuraciones (armas virtuales) | 7 | Tests de `firearms.ts` y del formulario |
| Tiros acumulados por arma | 7 | Test de `firearms.ts` |
| Blancos con zonas y tamaño de referencia | 8 | Tests de `target-zones.ts` |
| Sesión con todos sus campos y snapshot de personalizaciones | 9 | Tests de `sessions.ts` y del formulario |
| Rondas con blanco, distancia, disparos, puntaje, foto y comentarios | 10 | Tests de pantalla de la ronda |
| Detección automática y manual; agregar y quitar impactos | 11 | Tests de `impact-detection.ts` y del analizador |
| Puntaje, grupo (mm y MOA), PMI y distancia al centro | 11 | Tests de `metrics.ts` |
| El análisis propone el puntaje y el usuario lo confirma | 11 | Test de pantalla de la confirmación |
| Rendimiento con filtros por configuración, munición, blanco, distancia, etc. | 12 | Tests de `performance.ts` |

## Riesgos y alternativas descartadas
- **Riesgo:** la detección automática sobre fotos reales (impactos dentro del centro negro, sombras, papel arrugado, perspectiva) puede ser poco confiable. → **Mitigación:** la detección solo propone; el marcado manual es siempre el camino garantizado. Se acota a la zona calibrada del blanco, con tamaño de agujero esperado en mm, y se prueba con un set de fotos reales que aporte el usuario.
- **Riesgo:** la foto sacada en ángulo deforma las distancias. → **Mitigación:** se pide sacarla de frente; la corrección de perspectiva queda fuera del MVP.
- **Riesgo:** Firebase Storage no tiene cola offline propia. → **Mitigación:** cola propia en IndexedDB (`upload-queue.ts`).
- **Riesgo:** el login con popup falla en PWA instalada en iOS. → **Mitigación:** `signInWithRedirect` en mobile y `authDomain` igual al dominio de Hosting.
- **Riesgo:** el alcance es grande para una sola iteración. → **Mitigación:** cada paso deja la app desplegable; si hace falta, se corta después del paso 10 y el análisis/rendimiento pasan a la 001.
- **Alternativa descartada:** rondas como subcolección. → **Por qué:** Rendimiento necesita todas las rondas con su sesión; embebidas se leen en una sola consulta, sin índices de collection group, y una sesión nunca se acerca al límite de 1 MB. Se documenta en un ADR.
- **Alternativa descartada:** guardar solo los impactos y recalcular métricas siempre. → **Por qué:** si se edita el blanco después, cambiaría el historial. Se guarda un snapshot de métricas, igual que con las personalizaciones.
- **Alternativa descartada:** Cloud Functions para validar o agregar. → **Por qué:** las reglas alcanzan para la privacidad y las agregaciones son chicas (un solo usuario); evita el plan Blaze.

## Decisiones tomadas
| Tema | Decisión |
|---|---|
| Idioma del código | Código e identificadores en inglés; textos de la UI y documentación en castellano (actualizado en `CLAUDE.md`) |
| Lenguaje | TypeScript |
| Calibración de la foto | No hace falta que la foto muestre todo el blanco. **Anillos:** el usuario toca el centro y un punto sobre cualquier anillo visible, y elige de una lista cuál es (por defecto se propone el más grande visible); la escala sale del diámetro de esa zona. Los anillos calibrados se dibujan sobre la foto para verificar y ajustar. **Sin zonas:** toca el centro y dos puntos cualesquiera, y escribe la distancia real entre ellos en mm. Sin corrección de perspectiva en el MVP; la foto se saca de frente. Los impactos fuera de la foto no se pueden marcar: se ve el aviso de impactos ≠ disparos y el usuario puede conservar el puntaje manual |
| Fotos sin conexión | Entra en el MVP: cola de subidas pendientes en IndexedDB (`upload-queue.ts`, paso 13) |
| Proyecto de Firebase | No existe todavía. Se desarrolla y testea contra los emuladores; el proyecto (con plan Blaze, necesario para Storage) se crea en el paso 14. El usuario hace `firebase login` |
| Emails autorizados | Se cargan a mano desde la consola de Firebase; sin pantalla de administración |
| Unidades | La preferencia mm / pulgadas solo cambia cómo se muestran las medidas del análisis. La distancia de tiro va en metros y los blancos se cargan en mm |

## Preguntas abiertas
- Ninguna.

## Al terminar
- [ ] Todos los criterios de aceptación verificados
- [ ] Tests y lint pasan
- [ ] `docs/arquitectura.md` actualizado
- [ ] ADR creado si corresponde
- [ ] `notas.md` completado
