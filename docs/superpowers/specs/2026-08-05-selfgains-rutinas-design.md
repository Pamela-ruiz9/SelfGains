# SelfGains — Rutinas

## Visión

Extiende el pilar "Aprender a entrenar" con el concepto de rutina: un plan de qué ejercicios tocan cada día de la semana, que el usuario sigue durante un período de tiempo. Cierra el ítem de roadmap "Planes predefinidos que referencien la taxonomía muscular" y le da un uso real a la columna `workouts.plan_id`, que existe desde el corte 1 pero nunca se usó.

Una rutina puede ser predefinida (curada, versionada en el repo) o creada por el propio usuario. Activar una rutina la vincula a un período (fecha de inicio + duración en semanas); al vencer ese período, se sugiere elegir una nueva. "Registrar entrenamiento" refleja la rutina activa precargando los ejercicios del día, sin dejar de permitir registrar cualquier otra cosa.

## Decisiones de alcance

- **Rutinas predefinidas y personalizadas conviven.** Las predefinidas viven como content collection (mismo patrón que `exercises`); las personalizadas las arma el usuario y viven en Supabase, porque son datos de usuario, no contenido versionado.
- **Estructura por día:** cada rutina define un conjunto de ejercicios por día de la semana fijo (lunes a domingo), no por número de día en un ciclo. Un día sin ejercicios asignados es descanso.
- **Una rutina activa por usuario.** Activar una rutina nueva reemplaza la anterior sin confirmación extra — no hay historial de rutinas activas pasadas en este corte.
- **La duración es informativa, con aviso al vencer.** No bloquea nada: al pasarse de las semanas planeadas, se muestra un aviso sugiriendo elegir una rutina nueva (misma UI que activar cualquier otra).
- **Rutinas vive en una pestaña nueva** (`/rutinas/`), separada de "Registrar entrenamiento". Es donde se navegan las predefinidas, se arman las propias, y se ve/activa la rutina actual.
- **La integración con Registrar es un nice-to-have, no el corazón de la feature.** Rutinas funciona completo sin tocar Registrar. La integración decidida: los ejercicios del día de la rutina activa aparecen como tarjetas precargadas (ver más abajo), y se sigue pudiendo agregar cualquier otro ejercicio como hoy.

## Modelo de datos

### Rutinas predefinidas — extensión de `src/content/plans`

Este content collection existe desde el corte 1 (`name`, `goal`, `level`) pero está vacío. Se le agrega el campo `days`:

```ts
// src/content.config.ts
const weekday = z.array(z.string()).default([]);

const plans = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/plans' }),
  schema: z.object({
    name: z.string(),
    goal: z.string(),
    level: z.string(),
    days: z.object({
      lunes: weekday,
      martes: weekday,
      miercoles: weekday,
      jueves: weekday,
      viernes: weekday,
      sabado: weekday,
      domingo: weekday,
    }),
  }),
});
```

Cada valor de `days.*` es un array de ids de ejercicios (los mismos ids que usa `exercises`, ej. `press-banca`). Un array vacío (u omitido, gracias al `.default([])`) significa descanso ese día. Ejemplo:

```yaml
# src/content/plans/push-pull-legs.md
---
name: Push/Pull/Legs
goal: Hipertrofia
level: Intermedio
days:
  lunes: [press-banca, press-militar, extension-triceps-polea]
  martes: [remo-barra, dominadas, curl-biceps-mancuernas]
  jueves: [sentadilla, zancadas, curl-femoral]
  viernes: [elevaciones-laterales, pajaros-mancuernas]
---
```

Se agregan 2-3 rutinas predefinidas de ejemplo con este corte (Push/Pull/Legs, Full body, alguna más).

No hay validación de que los ids en `days` existan en `exercises` — mismo nivel de confianza que el resto del contenido versionado en el repo (lo revisa quien escribe el `.md`).

### Rutinas personalizadas — tabla nueva `routines`

```sql
create table routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  days jsonb not null,  -- { "lunes": ["press-banca"], "martes": [...], ... }, mismo shape que las predefinidas
  created_at timestamptz not null default now()
);

alter table routines enable row level security;

create policy "Users can manage their own routines"
  on routines for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### Rutina activa — tabla nueva `active_routines`

Una fila por usuario. Activar una rutina hace upsert por `user_id`, reemplazando cualquier activación anterior.

```sql
create table active_routines (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source text not null check (source in ('predefined', 'custom')),
  routine_ref text not null,  -- slug del .md si source='predefined', routines.id (uuid) si source='custom'
  started_at date not null default current_date,
  duration_weeks integer not null check (duration_weeks > 0),
  created_at timestamptz not null default now()
);

alter table active_routines enable row level security;

create policy "Users can manage their own active routine"
  on active_routines for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

El estado "vencida" se calcula en el cliente (`started_at + duration_weeks semanas < hoy`), no hay job ni trigger — es una comparación de fechas al renderizar.

### `workouts.plan_id` (ya existe, hoy sin uso)

Al guardar un entrenamiento, se completa con `routine_ref` de la rutina activa en ese momento (o `null` si no hay ninguna). Es texto libre, igual que `active_routines.routine_ref` — no hay foreign key formal porque puede apuntar a un slug de content collection o a un uuid de `routines`, según `source`.

## Componentes

```
src/
├── content.config.ts                          # schema de `plans` extendido con `days`
├── content/plans/*.md                         # rutinas predefinidas de ejemplo (nuevas)
├── types/db.ts                                # + Routine, ActiveRoutine
├── lib/
│   └── routines.ts                            # createRoutine, getMyRoutines, activateRoutine,
│                                               # getActiveRoutine, deactivateRoutine (nuevo)
├── components/react/
│   ├── RoutineManager/
│   │   └── RoutineManager.tsx                 # pestaña Rutinas completa (nuevo)
│   └── WorkoutLogger/
│       └── WorkoutLogger.tsx                  # + tarjetas del día, + plan_id al guardar (tocado)
└── pages/
    └── rutinas/
        └── index.astro                        # carga plans + exercises, monta RoutineManager (nuevo)
```

**`lib/routines.ts`** — mismo estilo que `lib/workouts.ts` (funciones async sobre `supabase`, lanzan si no hay sesión).

**`RoutineManager.tsx`** — props: `predefinedRoutines` (de `getCollection('plans')`), `exercises` (para el picker de la rutina personalizada). Tres secciones:

1. **Rutina activa** — si `getActiveRoutine()` devuelve algo: nombre, desglose por día, barra "Semana X de Y" calculada desde `started_at`/`duration_weeks`. Si venció, banner de aviso en vez de la barra, con el mismo flujo de activar abajo.
2. **Predefinidas** — lista de `predefinedRoutines`, cada una con nombre/objetivo/nivel/desglose y botón "Activar" (abre un input de semanas + confirmar → `activateRoutine({ source: 'predefined', routineRef: slug, durationWeeks })`).
3. **Mis rutinas** — lista de `getMyRoutines()`, mismo botón "Activar". Arriba, "+ Crear rutina": nombre + un multi-select de `exercises` por cada día de la semana → `createRoutine(name, days)`.

**`WorkoutLogger.tsx`** (tocado) — al montar, además de la sesión, resuelve la rutina activa y el día de la semana de hoy (`date` ya es un estado existente). Si hay ejercicios para hoy:

- Por cada uno, una tarjeta con su propio mini-formulario de reps/peso/RPE (misma validación que existe hoy), que agrega a `loggedSets` igual que el formulario genérico.
- Debajo, el formulario genérico actual ("+ Agregar otro ejercicio") se mantiene sin cambios, para cualquier ejercicio fuera de la rutina.

Si no hay rutina activa, o hoy es descanso, `WorkoutLogger` se ve exactamente igual que hoy — la lógica nueva es aditiva, no reemplaza el formulario existente.

Al llamar `createWorkout`, se le pasa el `routine_ref` de la rutina activa (o `undefined`) para que lo guarde en `plan_id`.

**`Nav.astro`** (tocado) — se agrega `{ href: `${base}rutinas/`, label: "Rutinas" }` entre "Registrar" y "Progreso".

## Manejo de errores

- **Activar una rutina cuando ya hay una activa:** se reemplaza sin confirmación (es la semántica de "vas a mantener esta rutina ahora").
- **`duration_weeks` inválido:** se valida igual que reps/peso hoy — mensaje de error inline, mismo estilo visual.
- **Rutina custom activa que el usuario borra:** `active_routines.routine_ref` queda huérfano. `WorkoutLogger` y `RoutineManager` lo resuelven mostrando el bloque de sugerencias/rutina activa vacío (sin romper la página) si no encuentran el `routine_ref` al resolverlo.
- **Sin sesión:** mismo patrón que `WorkoutLogger` hoy — `RoutineManager` muestra el mensaje de "debés iniciar sesión" en vez de las tres secciones.

## Explícitamente fuera de este corte

- Historial de rutinas activas pasadas (solo existe "la actual").
- Días numerados en ciclo (día 1/2/3 sin atarse a día de semana) — se descartó a favor de días de semana fijos.
- Notificaciones push/email al vencer una rutina — el aviso es un banner dentro de la pestaña Rutinas, se ve solo si el usuario entra.
- Que "Progreso" agrupe o muestre nada por rutina — `plan_id` queda guardado desde este corte, pero consumirlo en Progreso es trabajo futuro.
- Editar o borrar una rutina personalizada ya creada (se puede crear y activar; editar/borrar queda para después).
- Validación cruzada de que los ids de ejercicios en una rutina predefinida existan en `exercises`.

## Testing

Igual que el resto del proyecto: sin suite automatizada. Verificación con `npm run build` (valida el schema de Zod de `plans` y de `routines`/`active_routines` a través de los tipos) y smoke test manual con Playwright: crear una rutina personalizada, activarla, verificar que aparecen las tarjetas del día correcto en Registrar, guardar un entrenamiento y confirmar que `plan_id` quedó seteado.
