# Diseño — RangeBook

Recursos de UI de la app. Es la fuente de verdad del diseño y refleja lo que está implementado: cada iteración que cambia la UI propone sus pantallas en `docs/features/NNN-nombre/diseno/` y, al cerrarse, esos cambios se incorporan acá.

| Archivo | Contenido |
|---|---|
| [design-system.md](./design-system.md) | Tokens (color, tipografía, espaciado, movimiento), íconos, layout responsive, componentes y mínimos de accesibilidad |
| [pantallas.md](./pantallas.md) | Rutas, especificación y estados de cada pantalla, métricas del análisis, comportamiento PWA y preguntas abiertas |
| [maqueta/index.html](./maqueta/index.html) | Maqueta navegable en HTML estático: 13 pantallas mobile (`maqueta/mobile/`) y 8 web (`maqueta/web/`) |
| `maqueta/assets/` | `frame.css` (marco de la maqueta), `app.js` (interacciones genéricas), `viewer.css` y `viewer.js` (visor de la foto del blanco, con zoom), `calibration.js` (calibración de la foto) y `analyzer.js` (analizador de impactos de referencia) |

## Cómo ver la maqueta

- Abrir `maqueta/index.html` con doble clic. Funciona sin servidor ni instalación; solo necesita internet para las fuentes de Google.
- Opcional, para verla desde el celular en la misma red: `pnpm dlx serve docs/diseno/maqueta` y abrir la URL de red que muestra.
- En desktop, las pantallas mobile se ven dentro de un marco de teléfono. En un celular ocupan toda la pantalla.

## Cómo usar estos recursos al implementar

1. Leer `design-system.md` y llevar los tokens a `src/styles/tokens.css` antes de crear componentes.
2. Para cada pantalla, leer su sección en `pantallas.md` y abrir el HTML correspondiente (tabla de rutas) como referencia visual: estructura, jerarquía, textos y espaciados.
3. La maqueta **no** es código para copiar. Usa estilos inline y CSS repetido por página. Hay que reimplementarla como componentes React reutilizables (lista en `design-system.md` → Componentes).
4. `maqueta/assets/analyzer.js` y `calibration.js` muestran el cálculo de las métricas, la calibración y la interacción del analizador. La implementación real va en `src/lib/`, como funciones puras con tests.
5. Las dependencias que proponen estos documentos (`lucide-react` y, si hace falta, una librería de gráficos) se deciden en `plan.md`, como pide `CLAUDE.md`.

## Cambios de diseño por iteración

Cuando una feature o un fix cambia la UI, no se edita esta carpeta directamente. Primero se propone el cambio en la carpeta de la iteración:

```
docs/features/NNN-nombre/diseno/
  cambios.md      ← pantallas nuevas, modificadas y eliminadas; qué cambia en pantallas.md y design-system.md
  maqueta/
    index.html    ← solo las pantallas que cambian, con etiqueta "Nueva" o "Modificada"
    mobile/  web/  assets/
```

- La maqueta de la iteración es autocontenida: copia de `docs/diseno/maqueta/` las pantallas que cambian y los assets que usan. Así sigue mostrando lo que se aprobó aunque la maqueta general cambie después.
- Se aprueba junto con `plan.md`, y durante la implementación es la referencia visual.
- Al cerrar la iteración, los cambios se llevan a `docs/diseno/` (maqueta, `pantallas.md` y `design-system.md`), ajustados a lo que realmente se implementó. Los desvíos respecto de lo aprobado se anotan en `notas.md` de la iteración.
