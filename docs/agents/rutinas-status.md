# Rutinas — estado

Pestaña `/rutinas/`: rutinas predefinidas (curadas, contenido versionado) o creadas por el usuario, activables con una duración en semanas; "Registrar entrenamiento" precarga tarjetas con los ejercicios del día de la rutina activa. Spec y plan en `docs/superpowers/specs/2026-08-05-selfgains-rutinas-design.md` y `docs/superpowers/plans/2026-08-05-rutinas.md`.

## Completado (2026-08-05/06)

**Modelo de datos**
- `src/content/plans/*.md` extendido con un campo `days` (lunes–domingo → lista de ids de ejercicio); 2 rutinas de ejemplo (`push-pull-legs.md`, `full-body.md`).
- Tablas nuevas en Supabase: `routines` (rutinas propias del usuario) y `active_routines` (una fila por usuario, `source: 'predefined'|'custom'`, `routine_ref`, `started_at`, `duration_weeks`). RLS igual al patrón de `workouts`/`workout_sets`.
- `workouts.plan_id` (existía desde el corte 1, nunca usado) ahora se completa al guardar un entrenamiento.

**Código**
- `src/lib/weekdays.ts` — taxonomía de 7 días + `getTodayWeekday()`.
- `src/lib/routines.ts` — CRUD sobre `routines`/`active_routines` (mismo estilo que `lib/workouts.ts`).
- `src/components/react/RoutineManager/` (`RoutineManager.tsx`, `RoutineList.tsx`, `CreateRoutineForm.tsx`) — pestaña completa: rutina activa (con barra "Semana X de Y" o aviso de vencida), predefinidas, mis rutinas, crear rutina.
- `WorkoutLogger.tsx` — bloque "Hoy toca" con una tarjeta por ejercicio del día de la rutina activa (reutiliza la misma validación que el formulario libre, que sigue intacto debajo).

Commits: `620ed58`, `2f7c398` (más los de la sesión de brainstorming/spec/plan previos).

## Verificación hecha

- `npm run build` limpio en cada tarea (12 tareas, ejecutadas con subagentes: implementador + revisión de spec + revisión de calidad por cada una).
- **Migración aplicada a Supabase real** (con autorización explícita del usuario) vía `supabase link` + `supabase db query --file`, no vía `supabase db push` (este repo no tiene `supabase/migrations/`, `supabase/schema.sql` es la referencia manual).
- Smoke test end-to-end contra la base real: cuenta de prueba creada y confirmada por Admin API (`email_confirm: true`, bypassea confirmación por email), login → activar Push/Pull/Legs → crear rutina propia → ver sugerencias del día en Registrar → guardar entrenamiento → confirmar `plan_id` en la DB. Cuenta borrada al final (cascade limpia `routines`/`active_routines`/`workouts` automáticamente).
- Casos borde verificados también en vivo (encontrados por la revisión final, no por el smoke test original): banner de rutina vencida ("venció hace N semana(s)") y rutina personalizada borrada mientras está activa (fallback a "Rutina desconocida", sin romper la página) — ambos confirmados sin errores de consola.

## Actualizado (2026-08-15) — CRUD completo, targets, reorden, adherencia

Todo lo que esta sección original marcaba como faltante sobre edición/borrado ya se hizo, más varias features nuevas encima:

- **CRUD completo de rutinas propias y de entradas de log**: editar/borrar una rutina personalizada ya creada (antes solo se podía crear y activar), editar/borrar sets y sesiones ya guardadas desde el historial de `/progreso/` (`WorkoutHistory.tsx`). Commit `976922c`.
- **Reordenar ejercicios dentro de un día de rutina** (flechas arriba/abajo en el editor) — commit `ec30785`.
- **Prescribir un target por actividad del día**: series/reps para gym, distancia para cardio (no duración — ver por qué en la nota de abajo). `RoutineActivityTarget` es un tipo nuevo en `src/lib/weekdays.ts`; `RoutineDayEntry` pasó a ser `string | RoutineActivityTarget` (unión) para no romper rutinas predefinidas ni ya creadas, que siguen siendo strings planos sin target. Commit `1ba6c43`.
  - **Corrección posterior (2026-08-16, commit `c189f20`):** se había agregado también un target de duración ("Tiempo (min)") al prescribir cardio, pero el usuario pidió sacarlo — la duración real de una sesión de natación/running es lo que se termina registrando en Registrar, no algo que la rutina deba fijar de antemano (solo la distancia tiene sentido como meta). El campo `targetDurationMin` se dejó en la interfaz por compatibilidad con datos ya guardados, pero ya no se pide en el formulario ni se muestra en ningún lado.
- **Distancia en metros en toda la UI** (antes km) — se sigue guardando en km internamente (columna `distance_km`, cálculo de ritmo), solo la UI convierte al mostrar/capturar (`kmToMeters`/`metersToKm` en `src/lib/activities.ts`). Commit `b88d46b`.
- **Adherencia semanal**: "Esta semana: X de Y días cumplidos" en la rutina activa, comparando los días programados contra los `workouts` reales de la semana (`src/lib/adherence.ts`). Commit `15208c8`.
- **Contador de día además del de semana** en la rutina activa ("Semana X de Y — día N de M"). Commit `6ea7fe5`.
- **Reorganización de la pestaña**: "Rutina activa" arriba, "Mis rutinas" (con Editar/Eliminar) justo debajo, y "Predefinidas"/"Crear rutina" quedaron detrás de un toggle colapsable "+ Agregar nueva rutina" en vez de estar siempre visibles — pedido explícito del usuario para que la pantalla no empiece abrumada de opciones. Commit `cc56322`.
- **Descripción de cada actividad visible al armar la rutina** (no solo en el explorador muscular) — `entry.body` de la colección de contenido se pasa como `description` a `ActivityOption`. Commit `3877c9c`.

Commits nuevos de este corte: `976922c`, `ec30785`, `1ba6c43`, `c189f20`, `b88d46b`, `15208c8`, `6ea7fe5`, `cc56322`, `3877c9c`.

## Lo que falta / limitaciones conocidas (actualizado 2026-08-16)

- Sin historial de rutinas activas pasadas (solo existe "la actual").
- `Progreso` no agrupa nada por `plan_id` todavía (sí lo guarda desde el corte 1, ver nota abajo — sigue sin consumirse; el resumen por disciplina que sí existe en `/progreso/` agrupa por disciplina practicada, no por qué rutina se estaba siguiendo).
- Sin notificación push/email al vencer una rutina — el aviso es un banner en `/rutinas/` y ahora también en `/perfil/` (atado al recordatorio de actualizar medidas corporales, ver `docs/agents/progreso-graficas-prs-status.md`), pero solo se ve si el usuario entra a esas pantallas.
- Sin suite de tests automatizada (consistente con el resto del proyecto).
- Fuera de alcance explícito del spec original: días numerados en ciclo (en vez de día de semana fijo), 1RM/volumen en las rutinas, validación cruzada de que los ids de ejercicio en una rutina predefinida existan realmente en `exercises`.
- El pool de ejercicios/actividades (`src/content/activities/`) es **solo-agregar por decisión explícita del usuario** — nunca renombrar/borrar un ejercicio existente, aunque se reorganicen nombres de actividades nuevas agregadas en la misma sesión. Vale para cualquier trabajo futuro sobre contenido, no solo rutinas.

## Si se retoma

- Si se quiere que `Progreso` agrupe por rutina: `plan_id` ya está guardado en cada `workout`, solo falta consumirlo ahí.
- Nota de entorno para quien repita la creación de usuarios de prueba vía Admin API: Supabase rechaza dominios de email tipo `@example.com` ("invalid email") — usar `@gmail.com` o similar funciona bien igual sin que el correo exista de verdad, ya que `email_confirm: true` evita necesitar recibirlo. **Ampliado 2026-08-16:** en sesiones sin acceso a la service-role key (agentes en background/auto-mode), no se puede llamar al Admin API directamente — ver la alternativa con `supabase db query --linked` en `docs/agents/notas-de-entorno-y-lecciones.md`.
