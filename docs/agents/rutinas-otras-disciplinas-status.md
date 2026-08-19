# Rutinas predefinidas para otras disciplinas — status

**Fecha:** 2026-08-19
**Pedido:** ítem del backlog en `docs/roadmap-ideas.md` — ya existía contenido de running/natación/combate (`docs/agents/multi-disciplina-status.md`), pero las rutinas predefinidas (`src/content/plans/`) eran solo de gym (Push/Pull/Legs, Full Body). Marcado explícitamente como trabajo de contenido, no de diseño de producto — no necesitaba spec.

## Qué se hizo

Tres archivos nuevos en `src/content/plans/`, mismo patrón exacto que `full-body.md`/`push-pull-legs.md` (frontmatter `name`/`goal`/`level`/`days`, cuerpo con una frase de contexto):

- **`running-base.md`** — 3 días (lunes/miércoles/viernes), alternando `running-trote-libre` y `running-series-400`. El catálogo de running solo tiene esas 2 actividades, así que el trote se repite dos veces en la semana.
- **`combate-cardio.md`** — 3 días, alternando `combate-boxeo-clase` y `combate-muay-thai-clase` (mismo motivo: solo 2 actividades en el catálogo de combate).
- **`natacion-tecnica-por-estilo.md`** — 3 días con progresión técnica por estilo: lunes crol (patada → brazada → catch-up → completo), miércoles dorso (misma progresión), viernes un día combinado de mariposa y pecho (solo el drill "completo" de cada uno). Es el único de los tres con variedad real de contenido, porque el catálogo de natación tiene ~30 drills repartidos en 4 estilos.

El schema de `plans` en `src/content.config.ts` no tiene campo `discipline` — un día de rutina es solo un array de ids de actividad, sin importar a qué disciplina pertenecen. Por eso esto fue puramente agregar contenido: no hizo falta tocar schema, componentes ni lógica. La UI que resuelve id→nombre y agrupa por día (`RoutineManager`/`RoutineList`) ya es agnóstica a disciplina desde la feature multi-disciplina, que ya probó rutinas custom con actividades mixtas.

## Verificación

- `npm run build` limpio (el schema de Zod valida que cada id referenciado en `days` exista como slug de actividad — si algún slug estuviera mal escrito, el build hubiera fallado).
- `npx tsc --noEmit` sin errores nuevos (el único error preexistente en `ProgressList.tsx` sigue igual, no relacionado).
- Playwright contra `npx astro preview` con la cuenta de prueba `crud-e2e-1786826288@gmail.com`: las 3 rutinas nuevas aparecen en "Elegir predefinida" con nombre, goal, nivel y los días agrupados con nombres de actividad resueltos correctamente (no ids crudos). Se activó "Running — Base" y quedó reflejada como rutina activa con semana/día calculados bien; después se desactivó y se reactivó la rutina original de la cuenta de prueba para dejarla como estaba.

## Lo que falta / no cubierto en esta ronda

- Running y combate quedaron con solo 2 actividades cada uno en el catálogo (`src/content/activities/`) — cualquier rutina predefinida ahí va a repetir esas mismas 2 actividades. Si se quiere más variedad real (ej. distintos tipos de series de running, otros golpes/combos de combate), es trabajo de catálogo, no de esta feature.
- No hay más de un plan por disciplina — a diferencia de gym, que tiene dos (Full Body y Push/Pull/Legs) para dar opciones. Con el catálogo actual de running/combate no hay suficiente contenido distinto para justificar un segundo plan sin repetir.
