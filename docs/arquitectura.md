# Arquitectura — Range Book

Estado del sistema al cierre de la iteración 000 (MVP). Las decisiones de fondo están en [`decisiones/`](./decisiones/); el diseño de la UI, en [`diseno/`](./diseno/).

## Resumen
SPA en **React 19 + TypeScript + Vite**, instalable como **PWA**, desplegada en **Firebase Hosting** (`range-book.web.app`). No hay backend propio: el cliente usa directamente **Authentication** (Google), **Firestore** y **Storage**, y las **reglas de seguridad** son la única barrera de privacidad ([ADR 0001](./decisiones/0001-firebase-desde-el-cliente.md)). Toda la lógica de negocio (métricas de tiro, calibración, detección de impactos, rendimiento, validaciones) son funciones puras en `src/lib/`, con tests.

```
Navegador / PWA
 ├─ Service worker (Workbox): app precacheada, Google Fonts y fotos de Storage en caché
 ├─ React: pantallas (src/screens) → componentes (src/components)
 │    └─ hooks (src/hooks): contexto, suscripciones en vivo, estado de UI
 │         └─ repositorios (src/data) ── SDK de Firebase ──┐
 └─ lógica pura (src/lib), usada por pantallas, hooks y repositorios
                                                            ▼
                 Firebase: Auth (Google) · Firestore (southamerica-east1) · Storage (us-east1)
```

## Estructura del código
| Carpeta | Contenido |
|---|---|
| `src/main.tsx`, `src/app.tsx`, `src/routes.tsx` | Entrada, registro del service worker, providers y rutas (React Router 7, `createBrowserRouter`) |
| `src/screens/` | Una pantalla (o sheet con ruta propia) por archivo, con sus tests de criterios de aceptación |
| `src/components/` | Componentes del sistema de diseño y de dominio (uno por archivo, CSS Modules). Los `*-provider.tsx` exponen los repositorios por contexto |
| `src/hooks/` | `useAuth`, `useProfile`, `useTheme`, `useCollection`, `useSessionData`, `useItemForm`, `useModal`, `useOnline`, `useInstall`, `useAppUpdate`, etc. |
| `src/data/` | Inicialización perezosa de Firebase (`firebase.ts`) y repositorios: `auth`, `profile`, `inventory` (genérico), `session`, `photo` y `upload-store` (IndexedDB) |
| `src/lib/` | Lógica pura: `metrics`, `calibration`, `impact-detection`, `target-center`, `target-zones`, `analysis`, `rounds`, `sessions`, `firearms`, `targets`, `inventory`, `performance`, `chart`, `zoom`, `format`, `units`, `theme`, `photos`, `image-compression`, `upload-queue`, `offline-write`, `install`, `auth`, `profile` |
| `src/styles/` | `tokens.css` (temas oscuro y claro) y `base.css` |
| `src/test/` | Dobles de los repositorios (`fake-*.ts`), `matchMedia` simulado, blancos sintéticos |
| `tests/rules/` | Tests de `firestore.rules` y `storage.rules` contra los emuladores |
| `scripts/` | `generate-icons.ps1` (íconos PWA) |

**Inyección de dependencias:** `App` recibe los repositorios (`auth`, `profiles`, `photos`, `inventory`, `sessions`) con los de Firebase por defecto; los tests pasan dobles en memoria. Firebase se inicializa recién la primera vez que se usa, así los tests no lo cargan.

## Rutas
| Ruta | Pantalla |
|---|---|
| `/login` | Login con Google |
| `/sesiones` (+ `:id`, `:id/rondas/nueva`, `:id/rondas/:roundId/editar`) | Lista de sesiones; detalle (en desktop, al lado de la lista); sheets de ronda |
| `/sesiones/nueva`, `/sesiones/:id/editar` | Formulario de sesión (página completa) |
| `/sesiones/:id/rondas/:roundId/analisis` | Análisis del blanco (página completa) |
| `/rendimiento` | Rendimiento; filtros en la query string |
| `/inventario/:category` (+ `nueva`/`nuevo`, `:id/editar`) | Inventario por categoría (`armas`, `configuraciones`, `municiones`, `poligonos`, `blancos`) con sheets de alta y edición |
| `/inventario/armas/:id` (+ `editar`, `modificaciones/…`, `configuraciones/…`) | Detalle del arma |
| `/perfil` | Perfil |
| `/componentes` | Catálogo de componentes (solo en desarrollo) |

Todo lo que no es `/login` pasa por `RequireAuth`. Los sheets y diálogos tienen URL propia, así "atrás" los cierra (salvo las instrucciones de instalación en iOS, que son solo informativas).

## Modelo de datos (Firestore)
```
allowedEmails/{email en minúsculas}   {}  — se carga a mano desde la consola
users/{uid}                           displayName, photoURL, units ('mm'|'in'), theme ('dark'|'light'|'system')
  firearms/{id}                       brand, model, caliber, purchaseDate|null, purchasePlace, priorShots, photos[], archived
    modifications/{id}                brand, model, comments, archived
  configurations/{id}                 name, firearmId, modificationIds[], archived   ("Stock" es implícita)
  ammunition/{id}                     brand, model, description, archived
  ranges/{id}                         name, address, archived
  targets/{id}                        name, photo|null, scoring ('rings'|'none'), referenceSizeMm, zones[{score, diameterMm}], archived
  sessions/{id}                       date, firearmId, configurationId|null, modificationsSnapshot[{brand, model}],
                                      rangeId, weather|null, ammunitionId, photos[], notes,
                                      rounds[{id, targetId, distanceM, shots, manualScore|null, score|null,
                                              photo|null, comments, analysis?}]
```
- **Rondas embebidas** en la sesión ([ADR 0002](./decisiones/0002-rondas-embebidas.md)). Se modifican leyendo y reescribiendo el array crudo, sin transacción, para que funcione sin conexión.
- **`analysis`** = `{ calibration, impacts (mm desde el centro), metrics, scoreConfirmed }`. La calibración guarda los píxeles de los marcadores, el tamaño de la foto y, si se deformó, la elipse (`shape`).
- **Snapshots:** las personalizaciones de la sesión y las métricas del análisis se copian al guardar ([ADR 0003](./decisiones/0003-snapshots-del-historial.md)).
- **Nada del inventario se borra:** se archiva. Las sesiones y las rondas sí se eliminan (con "Deshacer").
- No hay índices compuestos: cada pantalla lee la colección completa del usuario y filtra en el cliente.

**Storage:** `users/{uid}/{firearms|sessions|rounds|targets}/{docId}/{photoId}.jpg`. Las fotos se comprimen en el cliente (lado mayor 2000 px, JPEG 80 %, sin EXIF) y se suben con `Cache-Control: immutable`. En Firestore solo se guarda la ruta.

## Seguridad
- `isAllowed()`: usuario autenticado, email verificado y presente en `allowedEmails`. `isOwner(uid)`: además, `request.auth.uid == uid`. Storage consulta Firestore con la misma condición (necesita el rol `firebaserules.firestoreServiceAgent` en la cuenta de servicio de Storage).
- Cada colección valida campos, tipos, longitudes y límites (iguales a los de `src/lib/`). Las reglas no recorren listas: el contenido de rondas, zonas y personalizaciones lo valida el cliente.
- Storage: solo imágenes de hasta 10 MB, solo bajo la carpeta del dueño.
- Tras el login, si el email no está autorizado, se cierra la sesión de Firebase y se muestra "no autorizado".

## Autenticación
Google con popup en el navegador y redirect en la PWA instalada. `authDomain` es el dominio de Hosting (`range-book.web.app`) para que el redirect funcione en iOS; el service worker no atiende `/__/`.

## Análisis de blancos
Todo en el cliente, con canvas y sin librerías ([ADR 0004](./decisiones/0004-analisis-en-el-cliente.md)):
1. **Calibración** (`calibration.ts`): centro + un punto sobre un anillo conocido (o dos puntos + distancia en blancos sin zonas). Opcionalmente, una elipse para compensar fotos en ángulo. Da la transformación píxeles ↔ mm. El centro se propone solo en blancos de anillos (`target-center.ts`, votación de gradientes).
2. **Detección** (`impact-detection.ts`): umbral adaptativo, erosión y componentes conexas con el tamaño de agujero esperado según el calibre.
3. **Métricas** (`metrics.ts`): puntaje y distribución por zonas, tamaño de grupo (mm y MOA), PMI (mm y hora de reloj) y distancia media al centro.
El editor trabaja en píxeles y convierte a mm al calcular y al guardar.

## Rendimiento
`performance.ts` agrega **rondas** filtradas (configuración, munición, blanco, polígono, distancia, período) en KPIs con delta contra el período anterior, series por sesión, comparación por munición, tabla ordenable y CSV (`;`, coma decimal, BOM). Si se mezclan distancias, el grupo y el PMI se comparan en MOA. Gráficos en SVG propio.

## Offline y PWA
- **Service worker** generado con `vite-plugin-pwa` (Workbox): precache de la app, `navigateFallback` a `index.html`, Google Fonts (`StaleWhileRevalidate`) y fotos de Storage (`CacheFirst`, 150 entradas). Una versión nueva queda esperando y se ofrece con un toast "Actualizar".
- **Firestore** con `persistentLocalCache` (IndexedDB, varias pestañas). `settleWrite` da una escritura por guardada al instante sin conexión, o a los 4 s si el servidor no confirma.
- **Cola de fotos** (`upload-queue.ts` + IndexedDB): toda foto pasa por la cola; sin conexión queda en el dispositivo (se ve y se analiza desde ahí) y se sube al abrir la app o al volver la conexión.
- Banner "Sin conexión" según `navigator.onLine`. "Instalar" en Perfil (`beforeinstallprompt`, instrucciones en iOS).
Detalle en [ADR 0005](./decisiones/0005-offline.md).

## Build, tests y despliegue
| Comando | Qué hace |
|---|---|
| `pnpm dev` | Vite con `.env.development.local` (emuladores si `VITE_USE_EMULATORS=true`) |
| `pnpm emulators` | Emuladores de Auth, Firestore, Storage y Hosting (`demo-rangebook`) |
| `pnpm test` | Vitest + Testing Library (jsdom) |
| `pnpm test:rules` | Tests de reglas contra los emuladores (necesita Java 21) |
| `pnpm lint` | ESLint (con `jsx-a11y` y `react-hooks`) + Prettier |
| `pnpm build` | `tsc -b` + Vite; Firebase va en su propio chunk |
| `pnpm run deploy` | Build y despliegue de hosting, reglas e índices en `range-book` (no `pnpm deploy`) |

- Proyecto `range-book` en plan Blaze. Bucket `range-book.firebasestorage.app` con CORS (`cors.json`, aplicado a mano con `gcloud`) para leer los píxeles de las fotos.
- Hosting: `/assets/**` inmutable; `index.html`, rutas de la SPA, `sw.js` y el manifest sin caché.
- Configuración por variables de entorno (`.env.example`).
