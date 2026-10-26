# Plan — [NNN] [Nombre de la iteración]

**Estado:** Propuesto | Aprobado | En curso | Terminado
**Requerimientos:** [./requerimientos.md](./requerimientos.md)
**Diseño:** [cambios.md](./diseno/cambios.md) · [maqueta](./diseno/maqueta/index.html) <!-- Solo si la iteración cambia la UI; si no, borrar la línea. -->

## Resumen del enfoque
<!-- Tres a cinco oraciones: cómo se va a resolver y por qué de esta forma. -->

## Impacto en la arquitectura
<!-- Qué módulos se tocan, qué se agrega, qué cambia en el modelo de datos. -->
- **Nuevo:** ...
- **Modificado:** ...
- **Sin cambios pero relevante:** ...

## Archivos
| Archivo | Acción | Motivo |
|---|---|---|
| `src/...` | crear | ... |
| `src/...` | modificar | ... |
| `tests/...` | crear | ... |

## Dependencias nuevas
<!-- Paquete, versión y por qué. "Ninguna" si no hay. -->
- Ninguna

## Pasos
<!-- Pequeños y verificables. Cada paso debería dejar la app funcionando. -->
- [ ] **1. [Título]**
  - Qué: ...
  - Verificación: ...
- [ ] **2. [Título]**
  - Qué: ...
  - Verificación: ...
- [ ] **3. [Título]**
  - Qué: ...
  - Verificación: ...

## Cobertura de criterios de aceptación
| Criterio | Paso(s) | Cómo se verifica |
|---|---|---|
| ... | 1, 2 | test `...` / prueba manual |

## Riesgos y alternativas descartadas
- **Riesgo:** ... → **Mitigación:** ...
- **Alternativa descartada:** ... → **Por qué:** ...

## Preguntas abiertas
<!-- Si hay alguna, no se implementa hasta resolverla. -->
- ...

## Al terminar
- [ ] Todos los criterios de aceptación verificados
- [ ] Tests y lint pasan
- [ ] `docs/arquitectura.md` actualizado
- [ ] `docs/diseno/` actualizado si la iteración cambió la UI
- [ ] ADR creado si corresponde
- [ ] `notas.md` completado