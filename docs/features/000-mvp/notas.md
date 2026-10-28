# Notas — 000 MVP

## Desvíos del plan

### Paso 1 — Base del proyecto
- **TypeScript 6.0 en lugar de 7.** `typescript-eslint` 8.72 solo soporta `typescript < 6.1`. Se fija `~6.0.3` hasta que haya soporte para TS 7.
- **ESLint 9 en lugar de 10.** `eslint-plugin-jsx-a11y` 6.10 todavía no declara soporte para ESLint 10. Se usa `eslint@^9.39.5` (pnpm lo marca como deprecado, pero funciona).
- **Dependencias de desarrollo extra** que no figuraban en el plan, todas complementos habituales de las ya aprobadas:
  - `@eslint/js` y `globals` → configuración base de ESLint (flat config).
  - `eslint-config-prettier` → apaga las reglas de ESLint que chocan con Prettier.
  - `@types/react`, `@types/react-dom`, `@types/node` → tipos.
- **Reglas de Firestore y Storage cerradas.** `firebase.json` necesita que existan `firestore.rules` y `storage.rules`; por ahora niegan todo. Las reglas reales llegan en el paso 3.
- **Proyecto `demo-rangebook` en `.firebaserc`.** El prefijo `demo-` hace que los emuladores funcionen sin un proyecto real ni `firebase login`. Se reemplaza en el paso 14.
- **`src/routes.tsx` todavía no existe.** Se crea junto con `react-router` cuando haya rutas.
- Se excluyen `docs/` y `CLAUDE.md` de Prettier para no reformatear la documentación.

### Entre el paso 1 y el 2 — Diseño global
- **El diseño pasó de `docs/features/000-mvp/diseno/` a `docs/diseno/`.** Desde ahora hay una sola maqueta (junto con `design-system.md` y `pantallas.md`) que refleja lo implementado; cada iteración propone sus cambios en su propia carpeta y se incorporan al cerrarla (ver `docs/diseno/README.md` y `CLAUDE.md`). En esta iteración la maqueta general ya es la aprobada, así que al cerrar solo hay que ajustarla a lo que se implementó.

### Paso 2 — Tokens, tema y componentes base
- **`react-router` y `lucide-react` se instalaron en este paso** (estaban aprobadas en el plan): el layout necesita `NavLink` y los íconos. Junto con eso se creó `src/routes.tsx`, con pantallas provisorias (`PlaceholderScreen`) para las 4 secciones.
- **Componentes extra** que no estaban en la lista del plan, para respetar "un componente por archivo":
  - `LinkButton` y `CardLink`: links de navegación con el aspecto de `Button` y `Card` (la tarjeta clickeable es un `<a>`).
  - `RemovableChip` y `ChipGroup`: separados de `Chip`.
  - `Logo`, `Sidebar`, `BottomNav` y `AppLayout`: el layout.
  - `ToastProvider` + `useToast` (en `src/hooks/use-toast.ts`) para mostrar los `Toast`.
  - `field-context.ts`: `Field` les pasa a sus controles `id`, `aria-describedby`, `aria-invalid` y `aria-required` por contexto.
- **`BottomSheet` y `Dialog` son un solo componente** (`BottomSheet`): sheet desde abajo en mobile y diálogo centrado desde 1024 px, resuelto con CSS. El comportamiento común de los modales (foco, Escape, scroll bloqueado) está en `src/hooks/use-modal.ts`. El listener de Escape es nativo y está en el nodo de cada modal, para que la confirmación de "descartar cambios" abierta encima del sheet no lo cierre también.
- **`Fab` queda para el paso 9**, junto con la lista de sesiones, que es el único lugar donde se usa.
- **Catálogo de componentes en `/componentes`**, solo en desarrollo (`import.meta.env.DEV`): sirve para revisarlos contra la maqueta en los dos temas. No se incluye en el build de producción.
- La preferencia de tema usa los valores del modelo de datos (`dark` / `light` / `system`, clave `rb-theme`); la maqueta usaba `oscuro` / `claro` / `sistema`. El guardado en Firestore llega en el paso 4.
- **Las fuentes se cargan desde Google Fonts.** Si hay que autoalojarlas para que funcionen offline, se hace en el paso 13.

### Paso 3 — Login y autorización
- **`@firebase/rules-unit-testing` 5 en lugar de la última (6).** La 6 requiere `firebase` 13; el plan fija `firebase` 12, así que se usa la 5, que es la compatible.
- **Componentes extra:** `AuthProvider` (+ `useAuth` / `useCurrentUser` en `src/hooks/use-auth.ts`), `RequireAuth` (guard), `SplashScreen` (mientras se resuelve la sesión al abrir), `GoogleButton` y `Alert` (aviso en línea con acción opcional; se va a reusar, por ejemplo, en "detección fallida" del análisis).
- **Repositorios inyectables.** `App` recibe `auth` y `profiles` (por defecto los de Firebase); los tests usan `src/test/fake-auth.ts`. Firebase se inicializa recién la primera vez que se usa (`firebase()` en `src/data/firebase.ts`).
- **Redirect solo en la PWA instalada** (`display-mode: standalone` o `navigator.standalone`). En el navegador mobile el popup funciona bien y no saca al usuario de la página. Si el navegador bloquea el popup, se pasa a redirect.
- **"Reintentar"** repite lo que falló: si ya hay un usuario de Firebase (falló la verificación por red), vuelve a verificarlo sin pedir la cuenta; si no, vuelve a abrir el login. El selector de cuentas se muestra siempre (`prompt: select_account`) para poder probar con otra cuenta.
- **Reglas más estrictas que lo pedido:**
  - El perfil (`users/{uid}`) se valida (solo `displayName`, `photoURL`, `units`, `theme`, con valores válidos) y no se puede borrar.
  - Storage solo acepta imágenes de hasta 10 MB.
  - El id de `allowedEmails` es el email **en minúsculas**; las reglas comparan con `email.lower()`.
  - Se exige `email_verified` (las cuentas de Google siempre lo tienen).
- **`AppLayout` toma el usuario del contexto de auth** (la prop `user` sigue disponible y tiene prioridad).
- El build avisa que el bundle supera los 500 kB, por el SDK de Firebase. Se revisa con la división de código en el paso 13.

### Entre el paso 3 y el 4 — Se adelanta el proyecto de Firebase
- **El proyecto `range-book` se crea ahora y no en el paso 14.** Los emuladores no prueban el login real con Google (dominios autorizados, `authDomain`, redirect en la PWA de iOS) ni permiten usar la app desde el celular por HTTPS. Desplegar desde ahora deja probar cada paso en el entorno real.
- Por ahora queda en el plan **Spark**: Auth (Google), Firestore (`southamerica-east1`) y Hosting. Se pasa a **Blaze** en el paso 5, cuando haga falta Storage; ahí se despliega `storage.rules` y se agrega `storage` al script `deploy`.
- `pnpm deploy` hace el build y despliega `hosting` y `firestore` (reglas e índices) en `range-book`.
- `pnpm emulators` y `pnpm test:rules` fijan `--project demo-rangebook`, para que nunca toquen el proyecto real. `.firebaserc` tiene `range-book` por defecto y el alias `demo`.
- La configuración va en `.env.development.local` (emuladores) y `.env.production.local` (proyecto real), ambos fuera de git. `.env.example` documenta los dos.
- `authDomain` es `range-book.web.app` (el dominio de Hosting) y no `firebaseapp.com`, por la mitigación del riesgo del redirect en iOS. Para eso hubo que agregar `https://range-book.web.app/__/auth/handler` como URI de redirección del cliente OAuth en Google Cloud.
- `firebase.json` suma encabezados de caché: `/assets/**` inmutables (tienen hash); `index.html`, `/` y las rutas de la SPA (`**/!(*.*)`) sin caché, para que cada despliegue se vea al instante. El encabezado se aplica a la ruta pedida, no al `index.html` reescrito, por eso hacen falta las tres reglas.

### Paso 4 — Perfil
- **Resumen (sesiones, disparos, armas) con datos reales desde ya.** `subscribeSummary` en `profile-repository.ts` escucha `sessions` y `firearms`, y `profileSummary` (en `src/lib/profile.ts`) cuenta con tipos mínimos (`rounds[].shots`, `archived`), porque los modelos completos llegan en los pasos 7 y 9. Por ahora muestra ceros. Hay que revisarlo cuando existan los repositorios de sesiones y armas, y quizá moverlo ahí.
- **`ProfileProvider` + `useProfile` / `useUnits` / `useProfileSummary`** (en `src/hooks/use-profile.ts`): perfil en vivo con `onSnapshot`. El tema de Firestore manda: si cambia (por ejemplo, desde otro dispositivo), se aplica y se copia a `localStorage`. Al elegir un tema se aplica primero en local y después se guarda; si falla, avisa con un toast.
- **Componente `Avatar`** (foto de Google o iniciales); el `Sidebar` ahora lo usa. Si la foto no carga, muestra las iniciales.
- **Versión desde `package.json`**, inyectada por Vite como `__APP_VERSION__` (`src/globals.d.ts`). Se muestra `0.1.0`, sin el "(MVP)" de la maqueta.
- **El tipo `Units` pasó a `src/lib/units.ts`** (estaba en `lib/auth.ts`).
- Las etiquetas de "Unidades de medida" y "Tema" usan `Field` (14 px, `--text-2`) en lugar del texto de 16 px de la maqueta, para mantener el mismo estilo de etiqueta en toda la app.
- Cerrar sesión no pide confirmación (la maqueta no la muestra). Al volver a ingresar se vuelve a `/perfil`.
- Nuevo test de reglas: las preferencias se actualizan por separado con `updateDoc` y solo con valores válidos.

### Paso 5 — Fotos
- **Todavía no hay ninguna entidad que guarde fotos** (llegan en los pasos 7–10), así que "guardar la ruta en Firestore" queda como infraestructura: `uploadPhotos` (en `src/lib/photos.ts`) sube las fotos pendientes y devuelve **solo las rutas**, en orden, para escribirlas en el documento. Cada formulario la va a llamar **antes** de guardar, y va a borrar las fotos quitadas (`removedPhotos`) **después**, para que un error al guardar no deje el documento apuntando a fotos borradas. El id del documento nuevo se genera antes de guardarlo, para armar la ruta.
- **Archivo extra `src/lib/photos.ts`** (no estaba en la tabla del plan): tipo `PhotoDraft` (`stored` con la ruta, o `pending` con el `Blob` comprimido), `photoPath`, `uploadPhotos` y `removedPhotos`.
- **Componentes extra:** `Photo` (muestra una foto guardada o pendiente, con placeholder rayado mientras carga e ícono si falla) y `PhotoProvider` (+ `usePhotoRepository` / `usePhotoSrc` en `src/hooks/use-photos.ts`). `App` recibe `photos` (por defecto `firebasePhotoRepository`); los tests usan `src/test/fake-photos.ts`.
- **La compresión se hace al elegir la foto**, no al guardar: así la vista previa y la memoria usan la versión chica. Al pasar por el canvas se descartan los metadatos EXIF, incluida la ubicación GPS. Las vistas previas usan `URL.createObjectURL` y no se liberan (viven lo mismo que el `Blob`); son pocas y ya comprimidas.
- **`getDownloadURL` se cachea en memoria** y las fotos se suben con `Cache-Control: private, max-age=31536000, immutable`: cada foto tiene un id propio y nunca se reemplaza.
- `PhotoPicker` en mobile muestra Cámara / Galería y miniaturas de 88 px; en desktop, una grilla 4:3 con la zona "Arrastrá o elegí archivos" como última celda (sin botón de cámara). Se puede arrastrar sobre todo el componente. Con `multiple={false}`, elegir otra foto la reemplaza. Con `cover`, la primera es la portada (no hay "usar como portada" para reordenar).
- `PhotoGallery` muestra miniaturas cuando hay más de una foto. El encabezado de M03 (foto a todo el ancho con volver / editar encima, sin miniaturas) se arma en el paso 9.
- `pnpm deploy` ahora también despliega `storage` (reglas). `range-book` pasó al plan **Blaze** y el bucket `range-book.firebasestorage.app` se creó en **`us-east1`**: es una de las tres regiones con uso gratuito, y la latencia extra frente a São Paulo (~100–150 ms por pedido) no se nota porque las fotos se cachean. Firestore sigue en `southamerica-east1`; las reglas de Storage lo consultan igual. Las reglas ya están desplegadas.
- **La prueba manual de la cámara en el celular pasa al paso 7.** En producción no hay todavía ninguna pantalla con `PhotoPicker` (`/componentes` es solo de desarrollo) y el login con Google no acepta la IP local del dev server. En el formulario de arma se prueba de punta a punta: cámara, compresión, subida a Storage y ruta en Firestore. Si la primera subida falla con `403`, revisar que la cuenta de servicio de Storage tenga permiso para leer Firestore (reglas entre servicios).

## Pendientes
- `pnpm` ignoró el script de instalación de `protobufjs` (dependencia de `firebase-tools`). Los emuladores funcionan igual; si aparece algún problema, correr `pnpm approve-builds`.
- Al apagar los emuladores, el runtime de reglas de Storage imprime un `NullPointerException` de Java. Es inofensivo (el script sale con código 0).

## Aprendizajes
