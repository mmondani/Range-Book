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

## Pendientes
- `pnpm` ignoró el script de instalación de `protobufjs` (dependencia de `firebase-tools`). Los emuladores funcionan igual; si aparece algún problema, correr `pnpm approve-builds`.
- Al apagar los emuladores, el runtime de reglas de Storage imprime un `NullPointerException` de Java. Es inofensivo (el script sale con código 0).

## Aprendizajes
