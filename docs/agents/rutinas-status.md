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

## Lo que falta / limitaciones conocidas

- Sin historial de rutinas activas pasadas (solo existe "la actual").
- Sin editar/borrar una rutina personalizada ya creada (se puede crear y activar, nada más).
- `Progreso` no agrupa ni muestra nada por `plan_id` todavía, aunque ya se guarda desde este corte.
- Sin notificación push/email al vencer una rutina — el aviso es un banner en `/rutinas/`, solo se ve si el usuario entra.
- Sin suite de tests automatizada (consistente con el resto del proyecto).
- Fuera de alcance explícito del spec: días numerados en ciclo (en vez de día de semana fijo), 1RM/volumen en las rutinas, validación cruzada de que los ids de ejercicio en una rutina predefinida existan realmente en `exercises`.

## Si se retoma

- Si se quiere que `Progreso` agrupe por rutina: `plan_id` ya está guardado en cada `workout`, solo falta consumirlo ahí.
- Nota de entorno para quien repita la creación de usuarios de prueba vía Admin API: Supabase rechaza dominios de email tipo `@example.com` ("invalid email") — usar `@gmail.com` o similar funciona bien igual sin que el correo exista de verdad, ya que `email_confirm: true` evita necesitar recibirlo.
