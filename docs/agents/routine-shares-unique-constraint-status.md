# Constraint único en routine_shares — status

**Fecha:** 2026-08-20
**Pedido:** ítem de deuda técnica de `docs/roadmap-ideas.md` — se podía proponer la misma rutina dos veces a la misma persona (ej. doble click en "Compartir"), sin ningún constraint que lo evite. Elegido directamente por el usuario de la lista de deuda técnica. Proceso: brainstorming (una sola pregunta: qué tan estricto debía ser el bloqueo) → spec (`docs/superpowers/specs/2026-08-20-routine-shares-unique-constraint-design.md`) → plan (`docs/superpowers/plans/2026-08-20-routine-shares-unique-constraint.md`) → implementación con subagent-driven-development.

## Qué se hizo

Índice único parcial en `routine_shares`, solo sobre filas `pending`:

```sql
create unique index routine_shares_no_duplicate_pending
  on routine_shares (routine_id, to_user_id)
  where status = 'pending';
```

Al ser parcial (no un constraint de tabla completa), una vez que una propuesta se acepta o rechaza deja de contar — se puede volver a proponer la misma rutina a la misma persona más adelante sin problema. `proposeRoutineShare()` (`src/lib/routineShares.ts`) ahora traduce el código de error `23505` (violación de unique) a "Ya le propusiste esta rutina y sigue pendiente." en vez de dejar pasar el error crudo de Postgres. La UI (`ShareRoutinePicker` en `RoutineList.tsx`) no necesitó ningún cambio — ya mostraba `err.message` de cualquier error recibido.

## Verificación

- `npm run build` + `npx tsc --noEmit` limpios (único error preexistente esperado en `ProgressList.tsx`).
- Migración aplicada y verificada contra la base real vía `pg_indexes` (dos veces: por el implementador y de forma independiente por el revisor de spec compliance).
- Playwright con las dos cuentas de prueba reutilizadas (`crud-e2e-1786826288@gmail.com`, `rutinastest1786031687911@gmail.com`) — no estaban conectadas al empezar esta ronda, se reconectaron vía código de invitación:
  - Proponer una rutina propia de A a B → "Propuesta enviada."
  - Proponer la **misma** rutina a la **misma** persona de nuevo, mientras la primera sigue pendiente → mensaje "Ya le propusiste esta rutina y sigue pendiente.", no "Propuesta enviada.".
  - Confirmado por consulta directa a la base: el segundo intento **no creó una fila nueva** en `routine_shares` — el índice bloqueó el insert real, no fue solo un mensaje de UI sobre una fila que igual se creó.
  - B rechaza la propuesta → A vuelve a proponer la misma rutina a la misma persona → "Propuesta enviada." (el índice parcial liberó correctamente tras el rechazo).
  - Estado final verificado en la base: ambas filas de esta ronda quedaron en `rejected`, ninguna pendiente sin resolver.

## Lo que falta / no cubierto en esta ronda

- La condición de carrera en `acceptRoutineShare` (dos sesiones simultáneas aceptando la misma propuesta) sigue sin resolver — es un ítem separado de la lista de deuda técnica, no se tocó acá.
