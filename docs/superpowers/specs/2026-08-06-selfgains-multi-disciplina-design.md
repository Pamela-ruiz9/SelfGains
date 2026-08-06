# SelfGains — Multi-disciplina

## Visión

Hasta ahora SelfGains es 100% gym: el catálogo de contenido (`exercises`), la tabla de registro (`workout_sets`), las rutinas (`plans.days`/`routines.days`) y Progreso (PRs por peso máximo) asumen que todo lo que se entrena es una serie de reps a un peso. Este corte extiende el modelo para registrar disciplinas que no son levantamiento de pesas — arrancando con **running, natación y artes marciales/combate** — y permitir que una rutina mezcle disciplinas en el mismo día (ej. lunes: press banca + press militar + trote 5k).

El catálogo sigue curado por el mantenedor del contenido (mismo criterio que hoy con `exercises`: sin texto libre del usuario final), con varias actividades por disciplina (ej. "Running - trote libre" y "Running - series de 400m" son entradas separadas).

## Decisiones de alcance

- **Dos formas de métrica, no una por disciplina.** Gym registra series (`reps`/`peso`/`RPE`, sin cambios). Running y natación registran **distancia + tiempo**, ambos obligatorios. Combate registra **solo duración** — nunca distancia. Estas dos formas (`sets` y `session`) son el único eje de variación técnica; no hay una tabla o schema por disciplina.
- **El catálogo se unifica en una sola colección** (`activities`, reemplaza `exercises`), discriminada por `metricType: 'sets' | 'session'` y `discipline`. Esto es lo que permite que rutinas mixtas sigan siendo un array plano de ids sin cambiar de forma.
- **Selección por tabs de disciplina en la UI**, no un dropdown único con todo mezclado — se valida con mockup (ver decisión del usuario en la sesión de brainstorming): Gym / Running / Natación / Combate como tabs, el dropdown de abajo filtra según la tab activa.
- **PR de cardio = mejor pace** (`duration_min / distance_km` mínimo), no mayor distancia — refleja rendimiento, no solo volumen, igual que "más peso" refleja fuerza en gym.
- **Combate no tiene PR ni gráfica de progreso.** Una duración mayor no es necesariamente "mejor", así que sus sesiones solo aparecen en el historial de entrenamientos, no en ningún grid de récords.
- **`workout_sets` y toda la lógica de PRs de gym existente quedan intactas.** Se agrega una tabla (`workout_sessions`) y funciones nuevas en paralelo, en vez de modificar lo que ya está en producción y verificado (Explorador Muscular, PRGrid, ProgressChart).
- **Fuera de alcance explícito de este corte:** ciclismo y cualquier otra disciplina más allá de las tres elegidas (el modelo las soporta agregando contenido, pero no se seedean con este corte); comparar/graficar más de una actividad a la vez; notificación de PR nuevo al guardar; rounds/estilo de nado como campos estructurados (quedan en el nombre de la actividad, ej. "Muay Thai — clase").

## Modelo de datos

### Catálogo — `src/content/activities/` (reemplaza `src/content/exercises/`)

```ts
// src/content.config.ts
const activities = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/activities' }),
  schema: z.discriminatedUnion('metricType', [
    z.object({
      metricType: z.literal('sets'),
      name: z.string(),
      discipline: z.literal('gym'),
      muscles: z.array(
        z.string().refine((id) => muscleIds.includes(id), {
          message: 'Unknown muscle id — must match an id in src/lib/muscles.ts',
        })
      ),
      equipment: z.string(),
      videoUrl: z.string().url().optional(),
    }),
    z.object({
      metricType: z.literal('session'),
      name: z.string(),
      discipline: z.enum(['running', 'natacion', 'combate']),
      videoUrl: z.string().url().optional(),
    }),
  ]),
});
```

- Los 18 `.md` existentes se mueven de `exercises/` a `activities/`, agregando `metricType: sets` y `discipline: gym` al frontmatter. Contenido (`name`/`muscles`/`equipment`) sin cambios.
- Contenido nuevo con este corte (2-3 por disciplina, como seed): `running-trote-libre.md`, `running-series-400.md`, `natacion-estilo-libre.md`, `combate-boxeo-clase.md`, `combate-muay-thai-clase.md`. Cada uno solo con `name`/`discipline`/`metricType: session` — sin `muscles` ni `equipment`.
- `plans.days` (rutinas predefinidas) y `routines.days` (rutinas propias en Supabase) **no cambian de forma**: siguen siendo `string[]`/`{ lunes: string[], ... }` de ids, porque todos los ids —gym o no— viven en la misma colección `activities`.

### Registro — tabla nueva `workout_sessions`

```sql
create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  activity_id text not null,
  duration_min numeric not null check (duration_min > 0),
  distance_km numeric check (distance_km > 0),
  created_at timestamptz not null default now()
);

alter table workout_sessions enable row level security;

create policy "Users can manage sessions of their own workouts"
  on workout_sessions for all
  using (
    exists (
      select 1 from workouts
      where workouts.id = workout_sessions.workout_id
      and workouts.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from workouts
      where workouts.id = workout_sessions.workout_id
      and workouts.user_id = auth.uid()
    )
  );

create index idx_workout_sessions_workout_id on workout_sessions(workout_id);
```

- `distance_km` es nullable: running/natación siempre la completan (el form las exige), combate la deja en `null` porque esa disciplina nunca la pide.
- Sin constraint de unicidad (a diferencia de `workout_sets`): no hay noción de "serie" para una sesión, y nada impide loguear la misma disciplina dos veces el mismo día.
- `workout_sets` **no se modifica** — ni columnas nuevas ni cambios de constraint.

## Componentes

```
src/
├── content.config.ts                          # `activities` reemplaza `exercises` (tocado)
├── content/activities/*.md                    # 18 existentes movidos + 5 nuevos (tocado/nuevo)
├── types/db.ts                                # + WorkoutSession (nuevo)
├── lib/
│   ├── workouts.ts                             # + addSession, getSessionsForWorkout (tocado)
│   └── prs.ts                                  # + calculateCardioPRs, groupCardioPRsByDiscipline,
│                                                #   progressForCardioActivity (tocado, funciones nuevas
│                                                #   en paralelo a las de gym, que no se modifican)
├── components/react/
│   ├── ActivityPicker/
│   │   └── ActivityPicker.tsx                  # tabs de disciplina + dropdown filtrado (nuevo,
│   │                                            #   compartido entre WorkoutLogger y CreateRoutineForm)
│   ├── WorkoutLogger/
│   │   └── WorkoutLogger.tsx                   # + tabs, SessionFields, tabla de sesiones (tocado)
│   ├── RoutineManager/
│   │   └── CreateRoutineForm.tsx               # usa ActivityPicker en vez de un select de exercises (tocado)
│   └── ProgressList/
│       ├── ProgressList.tsx                    # + CardioPRGrid, + sesiones en el historial (tocado)
│       └── CardioPRGrid.tsx                    # grid de PRs de running/natación por disciplina (nuevo)
└── pages/
    ├── ejercicios/index.astro                  # getCollection('activities') filtrado a metricType='sets' (tocado)
    ├── registro/nuevo.astro                    # pasa `activities` en vez de `exercises` (tocado)
    ├── rutinas/index.astro                     # pasa `activities` en vez de `exercises` (tocado)
    └── progreso/index.astro                    # pasa `activities` en vez de `exercises` (tocado)
```

**`ActivityPicker.tsx`** (nuevo, compartido) — props: `activities: ActivityOption[]`, `value`, `onChange`. Tabs (Gym / Running / Natación / Combate) que filtran el dropdown de abajo por `discipline`. Se usa tanto en `WorkoutLogger` (agregar una actividad al entrenamiento) como en `CreateRoutineForm` (armar el día de una rutina propia) — es la única pieza de UI nueva no trivial, el resto es cablear el `metricType` a través de componentes existentes.

**`WorkoutLogger.tsx`** (tocado):

- El formulario "+ Agregar otra actividad" usa `ActivityPicker`. Debajo, se renderiza `SetFields` (existente) si la actividad elegida tiene `metricType: 'sets'`, o `SessionFields` (nuevo: distancia + tiempo, sin el campo distancia si `discipline === 'combate'`) si es `'session'`.
- Las tarjetas "Hoy toca" resuelven el `metricType` de cada id del día de la rutina activa contra `activities` y renderizan el set de campos correspondiente — así un día mixto de rutina (pesas + trote) funciona sin fricción.
- El estado local pasa de una sola lista (`loggedSets`) a dos: `loggedSets` (sin cambios) y `loggedSessions` (nuevo). Se muestran en dos tablas separadas ("Series registradas" / "Sesiones registradas") en vez de forzar una tabla con columnas que no siempre aplican.
- Al guardar: `createWorkout()` sin cambios → loop `addSet()` sin cambios → loop nuevo `addSession(workoutId, activityId, durationMin, distanceKm)`.

**`ProgressList.tsx`** (tocado) — además de `PRGrid`+`ProgressChart` de gym (sin cambios), monta `CardioPRGrid`+`ProgressChart` para running/natación con su propio estado de selección. `ProgressChart.tsx` no cambia — ya es genérico (fecha/valor); se le pasa pace formateado como "min/km" en vez de "kg". El historial de abajo agrega las `w.sessions` de cada workout junto a `w.sets` en la misma tarjeta por fecha.

**`prs.ts`** (tocado, funciones nuevas):

- `calculateCardioPRs(workouts: WorkoutWithSessions[])` — para cada `activity_id`, el mínimo `duration_min / distance_km` entre todas sus sesiones (solo sesiones con `distance_km` no nulo — combate, que nunca la tiene, queda afuera automáticamente).
- `groupCardioPRsByDiscipline(prs, activities)` — agrupa por `discipline` en vez de músculo. Igual que `groupPRsByMuscle`, un PR cuyo `activity_id` no está en el catálogo actual cae en un grupo "Otros" en vez de perderse (mismo fix que `bfc5e07`, mismo motivo).
- `progressForCardioActivity(workouts, activityId)` — un punto por fecha con el mejor pace de ese día, ordenado cronológicamente. Espejo de `progressForExercise`.

**`MuscleExplorer`** — sin cambios estructurales. Solo cambia de dónde lee: `getCollection('activities')` filtrado a `metricType === 'sets'` en vez de `getCollection('exercises')`.

## Manejo de errores

- **`SessionFields`:** duración > 0 obligatoria siempre; distancia > 0 obligatoria solo si `discipline` es running/natación (no se pide el campo en absoluto para combate). Mismo estilo que `parseSetInput` — mensajes inline en español, un `parseSessionInput` nuevo con las mismas reglas de validación.
- **PR/sesión huérfana:** una sesión logueada contra un `activity_id` que luego se borra del catálogo cae en el grupo "Otros" de `groupCardioPRsByDiscipline`, igual que el caso ya resuelto para gym.
- **RLS de `workout_sessions`:** copia exacta del patrón de `workout_sets` — mismos errores de permisos/auth, mismo manejo (`err.message` mostrado inline).
- **Sin sesión activa:** `WorkoutLogger` y `ProgressList` ya manejan este caso hoy (mensaje de "iniciá sesión"); no cambia.

## Explícitamente fuera de este corte

- Ciclismo u otras disciplinas más allá de running/natación/combate (el modelo las soporta agregando contenido `metricType: session`, pero no se seedean ahora).
- Rounds, estilo de nado, ritmo cardíaco u otros campos estructurados adicionales — quedan implícitos en el nombre de la actividad.
- PR o gráfica de progreso para combate.
- Comparar/superponer más de una actividad en la misma gráfica (ya era una limitación conocida de Progreso, se mantiene).
- Notificación al lograr un PR nuevo (cardio o gym) al momento de guardar.
- Validación cruzada de que los ids de `activities` referenciados en una rutina predefinida existan realmente en la colección.
- Migrar datos ya guardados en Supabase por usuarios reales — la app es de uso personal/de desarrollo en este momento, no hay migración de usuarios en producción a resolver.

## Testing

Igual que el resto del proyecto: sin suite automatizada. Verificación con `npm run build` (valida el schema discriminado de `activities` y los tipos de `workout_sessions`) y smoke test manual con Playwright contra una cuenta de prueba real (Admin API, `email_confirm: true`, borrada al final):

- Activar una rutina mixta (gym + running en el mismo día) → confirmar que "Hoy toca" muestra ambos tipos de tarjeta correctamente.
- Registrar un entrenamiento mixto cambiando de tab (Gym → Running → Combate), guardar, confirmar las filas correctas en `workout_sets` y `workout_sessions`.
- Cargar 3 sesiones de running con pace creciente → confirmar que el PR muestra el mejor (menor) pace, no el último ni el peor.
- Confirmar que combate no aparece en ningún grid de PR pero sí en el historial.
- Regresión: `/ejercicios/` (Explorador Muscular) sigue funcionando igual tras el cambio de colección.
- Caso borde: sesión logueada contra una actividad luego borrada del catálogo → cae en "Otros", no desaparece.
