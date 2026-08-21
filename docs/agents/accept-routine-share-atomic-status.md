# acceptRoutineShare atómico — status

**Fecha:** 2026-08-20
**Pedido:** último ítem de deuda técnica de Conexiones en `docs/roadmap-ideas.md` — `acceptRoutineShare` no era atómico contra dos llamadas concurrentes aceptando la misma propuesta, podía crear dos copias de la rutina. Elegido directamente por el usuario. Proceso: brainstorming (una pregunta: reordenar vs. RPC de Postgres) → spec (`docs/superpowers/specs/2026-08-20-accept-routine-share-atomic-design.md`) → plan (`docs/superpowers/plans/2026-08-20-accept-routine-share-atomic.md`) → implementación con subagent-driven-development.

## Qué se hizo

Se reordenó `acceptRoutineShare` (`src/lib/routineShares.ts`) para que la copia de la rutina no pueda duplicarse ante dos llamadas concurrentes (doble click, dos pestañas). El `UPDATE` condicional que reclama la propuesta (`status='pending'` → `'accepted'`) ahora corre antes del `INSERT` que copia la rutina — solo quien gana ese `UPDATE` sigue adelante, la llamada perdedora ve 0 filas afectadas y aborta antes de insertar nada. Si el `INSERT` falla después de reclamar, se revierte el estado a `pending` (guardado con `.eq('status', 'accepted')`, nunca una escritura ciega) para que la propuesta quede reintentable. Sin funciones RPC ni transacciones — sigue siendo una secuencia de llamadas `supabase.from(...)`.

**Un bug real encontrado y corregido durante la verificación en vivo** (documentado en detalle en `docs/agents/notas-de-entorno-y-lecciones.md`, sección "RLS: reordenar un UPDATE antes de una lectura puede bloquear esa misma lectura sin avisar"): la primera versión del reordenamiento movía el `UPDATE` de reclamo **antes** de leer la rutina origen — pasó build, `tsc`, y dos revisiones de código completas, pero rompía la función en cada llamada real. La política de RLS que permite al receptor leer la rutina compartida exige `routine_shares.status = 'pending'`; con el reclamo corrido primero, esa lectura quedaba bloqueada por RLS en silencio, y `acceptRoutineShare` fallaba siempre con "No se encontró la rutina compartida.". Se detectó recién al correr el flujo completo contra Supabase real. Fix: las lecturas (sin efectos secundarios) se quedan en su posición original, antes de cualquier escritura; solo el `UPDATE` de reclamo se reordena, y se reordena relativo al `INSERT`, no relativo a las lecturas.

## Verificación

- `npm run build` + `npx tsc --noEmit` limpios en cada versión (único error preexistente esperado en `ProgressList.tsx`).
- Playwright con las dos cuentas de prueba conectadas: flujo normal de aceptar una propuesta — confirmado end-to-end contra la base real que la propuesta pasa a `accepted` y aparece exactamente una copia nueva de la rutina en `routines` (esto fue lo que expuso el bug de RLS en la primera versión, y lo que confirmó que la versión corregida sí funciona).
- Prueba directa de la carrera real: dos requests HTTP genuinamente concurrentes (`ThreadPoolExecutor`, no clicks de UI que no garantizan simultaneidad) contra el mismo `UPDATE` condicional, usando el token real de una sesión logueada — de las dos, exactamente una devolvió la fila reclamada (`status: accepted`), la otra devolvió `[]` sin error. Confirmado por consulta directa a la base que no se creó ninguna copia de rutina duplicada.
- Ruta de reversión confirmada por inspección de código: una sola escritura `status: 'pending'` en todo el archivo, en el branch de `insertError`, guardada con `.eq('status', 'accepted')`.
- Estado final de las cuentas de prueba verificado limpio: sin propuestas pendientes sin resolver.

## Lo que falta / no cubierto en esta ronda

- Nada — este era el último ítem de deuda técnica de Conexiones en `docs/roadmap-ideas.md`. Toda la deuda técnica de esa sección queda resuelta.
