# Range Book

App web (instalable como PWA) para llevar el registro de los entrenamientos en el polígono y analizar las fotos de los blancos.

## Qué hace

- **Sesiones de tiro:** arma o configuración, personalizaciones, fecha, polígono, clima, munición, fotos y notas. Cada sesión tiene **rondas** (blanco, distancia, disparos, puntaje, foto y comentarios).
- **Análisis de blancos:** calibración de la foto (anillo conocido o dos puntos a una distancia), detección automática de impactos, edición manual y métricas: puntaje, tamaño de grupo (mm y MOA), PMI y distancia al centro. El análisis propone el puntaje y el usuario lo confirma.
- **Rendimiento:** evolución por sesión con filtros por configuración, munición, distancia, blanco, polígono y período, KPIs contra el período anterior y exportación a CSV.
- **Inventario:** armas (con modificaciones y configuraciones), munición, polígonos y blancos con zonas de puntaje. Nada se borra: se archiva y se puede restaurar.
- **Perfil:** unidades (mm o pulgadas), tema oscuro, claro o del sistema, e instalación en el dispositivo.
- **Sin conexión:** los datos y las fotos se guardan en el dispositivo y se sincronizan al volver la conexión.

## Stack

React 19 + TypeScript + Vite, React Router 7, `lucide-react` y `vite-plugin-pwa`. Firebase (Authentication con Google, Firestore, Storage y Hosting) directamente desde el cliente, sin backend propio: las reglas de seguridad son la barrera de privacidad. Tests con Vitest y Testing Library; reglas probadas contra los emuladores de Firebase.

## Requisitos

- Node.js 24 y **pnpm** (no npm).
- Java 21, para los emuladores de Firebase (`pnpm emulators`, `pnpm test:rules`).

## Puesta en marcha

```bash
pnpm install
```

La configuración de Firebase va en variables de entorno (ver [`.env.example`](./.env.example)):

- `.env.development.local` para desarrollo. Con `VITE_USE_EMULATORS=true` y `VITE_FIREBASE_PROJECT_ID=demo-rangebook` usa los emuladores locales.
- `.env.production.local` para el build de producción, con los datos de la app web del proyecto de Firebase.

Desarrollo contra los emuladores:

```bash
pnpm emulators   # en una terminal: Auth, Firestore, Storage y la UI en http://localhost:4000
pnpm dev         # en otra: la app en http://localhost:5173
```

Para entrar hace falta que el email esté en la colección `allowedEmails` (id = email en minúsculas), que se carga a mano desde la UI de los emuladores o desde la consola de Firebase.

## Scripts

| Comando           | Qué hace                                                                                |
| ----------------- | --------------------------------------------------------------------------------------- |
| `pnpm dev`        | Servidor de desarrollo                                                                  |
| `pnpm build`      | Chequeo de tipos y build de producción en `dist/`                                       |
| `pnpm preview`    | Sirve el build localmente                                                               |
| `pnpm test`       | Tests unitarios y de pantallas                                                          |
| `pnpm test:rules` | Tests de las reglas de Firestore y Storage contra los emuladores                        |
| `pnpm lint`       | ESLint y Prettier                                                                       |
| `pnpm format`     | Formatea con Prettier                                                                   |
| `pnpm emulators`  | Emuladores de Firebase (proyecto `demo-rangebook`)                                      |
| `pnpm run deploy` | Build y despliegue de hosting, reglas e índices en `range-book` (no usar `pnpm deploy`) |

## Estructura

```
src/
  screens/     una pantalla (o sheet con ruta propia) por archivo
  components/  componentes del sistema de diseño y de dominio
  hooks/       contexto, suscripciones y estado de UI
  data/        acceso a Firebase (repositorios)
  lib/         lógica de negocio pura, con tests
  styles/      tokens de los temas
tests/rules/   tests de reglas de seguridad
docs/          visión, arquitectura, decisiones, diseño e iteraciones
```

## Documentación

- [Visión](./docs/vision.md) y [arquitectura](./docs/arquitectura.md).
- [Decisiones (ADRs)](./docs/decisiones/).
- [Diseño](./docs/diseno/): sistema de diseño, pantallas y maqueta navegable.
- [Iteraciones](./docs/features/): requerimientos, plan y notas de cada una.
- [`CLAUDE.md`](./CLAUDE.md): convenciones y flujo de trabajo.
