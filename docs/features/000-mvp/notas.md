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

## Pendientes
- `pnpm` ignoró el script de instalación de `protobufjs` (dependencia de `firebase-tools`). Los emuladores funcionan igual; si aparece algún problema, correr `pnpm approve-builds`.
- Al apagar los emuladores, el runtime de reglas de Storage imprime un `NullPointerException` de Java. Es inofensivo (el script sale con código 0).

## Aprendizajes
