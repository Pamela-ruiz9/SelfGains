# Multi-disciplina Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend SelfGains beyond gym so a user can register running, natación, and combate sessions — including mixing disciplines inside the same routine day and the same logged workout — while leaving the existing gym data model, PR logic, and Explorador Muscular completely untouched.

**Architecture:** The content collection `exercises` is renamed to `activities` and its schema becomes a Zod discriminated union on `metricType` (`'sets'` for gym, `'session'` for running/natación/combate), so routines and workouts keep referencing plain string ids across every discipline with no schema change to `plans.days`/`routines.days`. A new Supabase table `workout_sessions` (duration + optional distance) sits alongside the untouched `workout_sets`. A shared `ActivityPicker` component (tabs by discipline + a filtered dropdown) is reused by `WorkoutLogger` (logging) and `CreateRoutineForm` (building a routine day). `lib/prs.ts` gets new pure functions (`calculateCardioPRs`, `groupCardioPRsByDiscipline`, `progressForCardioActivity`, `formatPace`) alongside — not replacing — the existing gym PR functions; two new components (`CardioPRGrid`, `CardioProgressChart`) render them on `/progreso/`. Combate sessions are logged and shown in history but deliberately excluded from any PR/progress calculation.

**Tech Stack:** Astro content collections (Zod discriminated union), React (existing pattern, no new state libraries), Supabase (new table + RLS policy mirroring `workout_sets`), Recharts (already a dependency from the progress-charts feature).

**Reference:** Full design rationale in `docs/superpowers/specs/2026-08-06-selfgains-multi-disciplina-design.md`.

---

## File structure

```
src/
├── content.config.ts                           # `activities` replaces `exercises` (Task 1)
├── content/activities/*.md                     # 32 existing files moved + 5 new seed files (Task 1)
├── lib/
│   ├── activities.ts                            # isGymActivity type predicate (Task 1, new)
│   ├── workouts.ts                               # + addSession, getSessionsForWorkout (Task 3)
│   └── prs.ts                                    # + cardio PR/progress functions (Task 4)
├── types/db.ts                                   # + WorkoutSession (Task 2)
├── components/react/
│   ├── ActivityPicker/
│   │   └── ActivityPicker.tsx                    # tabs + filtered dropdown (Task 5, new, shared)
│   ├── WorkoutLogger/
│   │   └── WorkoutLogger.tsx                     # full rewrite (Task 6)
│   ├── RoutineManager/
│   │   ├── RoutineManager.tsx                    # prop rename (Task 7)
│   │   ├── RoutineList.tsx                       # prop rename (Task 7)
│   │   └── CreateRoutineForm.tsx                 # full rewrite (Task 7)
│   └── ProgressList/
│       ├── ProgressList.tsx                      # full rewrite (Task 9)
│       ├── CardioPRGrid.tsx                       # new (Task 8)
│       └── CardioProgressChart.tsx                # new (Task 8)
└── pages/
    ├── ejercicios/index.astro                    # `activities` + isGymActivity filter (Task 1)
    ├── registro/nuevo.astro                      # gym-only in Task 1, full catalog in Task 6
    ├── rutinas/index.astro                       # gym-only in Task 1, full catalog in Task 7
    └── progreso/index.astro                      # gym-only in Task 1, full catalog in Task 9

supabase/schema.sql                               # + workout_sessions table (Task 2)
```

`src/components/react/MuscleExplorer/**` and `src/components/react/Auth/**` are not touched by this plan — the explorer keeps receiving a gym-only `exercises` prop shaped exactly as it does today.

---

### Task 1: Rename the content collection to `activities`

**Files:**
- Modify: `src/content.config.ts`
- Create: `src/lib/activities.ts`
- Move: `src/content/exercises/*.md` → `src/content/activities/*.md` (32 files, frontmatter edited)
- Create: `src/content/activities/running-trote-libre.md`
- Create: `src/content/activities/running-series-400.md`
- Create: `src/content/activities/natacion-estilo-libre.md`
- Create: `src/content/activities/combate-boxeo-clase.md`
- Create: `src/content/activities/combate-muay-thai-clase.md`
- Modify: `src/pages/ejercicios/index.astro`
- Modify: `src/pages/registro/nuevo.astro`
- Modify: `src/pages/rutinas/index.astro`
- Modify: `src/pages/progreso/index.astro`

This task is a pure refactor: after it, the app behaves **exactly** as it does today (only gym content exists in the UI). No React component is touched. The 5 new running/natación/combate files are added to the catalog but stay invisible everywhere until later tasks build the UI for them.

- [ ] **Step 1: Replace the collection schema**

Replace the full contents of `src/content.config.ts` with:

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { MUSCLES } from './lib/muscles';

const muscleIds = MUSCLES.map((m) => m.id);

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

const routineDay = z.array(z.string()).default([]);

const plans = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/plans' }),
  schema: z.object({
    name: z.string(),
    goal: z.string(),
    level: z.string(),
    days: z.object({
      lunes: routineDay,
      martes: routineDay,
      miercoles: routineDay,
      jueves: routineDay,
      viernes: routineDay,
      sabado: routineDay,
      domingo: routineDay,
    }),
  }),
});

export const collections = { activities, plans };
```

`plans` is untouched — `days.*` stays a plain array of strings, unaware of which collection those ids come from.

- [ ] **Step 2: Add the gym type-predicate helper**

Create `src/lib/activities.ts`:

```ts
import type { CollectionEntry } from 'astro:content';

type ActivityEntry = CollectionEntry<'activities'>;
type GymActivityData = Extract<ActivityEntry['data'], { metricType: 'sets' }>;

// Narrows a mixed `activities` entry down to the gym ('sets') variant, so
// callers can access `muscles`/`equipment` without a manual cast. Pages that
// only ever need gym content (Explorador Muscular, the Progreso PR grid)
// filter with this before reading those fields.
export function isGymActivity(entry: ActivityEntry): entry is ActivityEntry & { data: GymActivityData } {
  return entry.data.metricType === 'sets';
}
```

- [ ] **Step 3: Move and update the 32 existing exercise files**

```bash
mkdir -p src/content/activities
git mv src/content/exercises/*.md src/content/activities/
rmdir src/content/exercises
for f in src/content/activities/*.md; do
  sed -i "2i\\
discipline: gym\\
metricType: sets" "$f"
done
```

This inserts two new frontmatter lines right after the opening `---` of every file, before `name:`. Field order doesn't matter to Zod. Spot-check one file:

```bash
cat src/content/activities/press-banca.md
```

Expected:

```
---
discipline: gym
metricType: sets
name: Press de banca
muscles: [pecho, triceps]
equipment: Barra
---

Acostado en el banco, baja la barra de forma controlada hasta rozar el pecho y empuja hacia arriba hasta extender los brazos, sin despegar los glúteos del banco.
```

- [ ] **Step 4: Add seed content for the three new disciplines**

Create `src/content/activities/running-trote-libre.md`:

```
---
name: Running — trote libre
discipline: running
metricType: session
---

Trote a ritmo cómodo, sin buscar un tiempo objetivo. Registrá la distancia y el tiempo total de la sesión.
```

Create `src/content/activities/running-series-400.md`:

```
---
name: Running — series de 400m
discipline: running
metricType: session
---

Repeticiones de 400 metros a ritmo alto, con descanso entre series. Registrá la distancia total recorrida (sumando todas las series) y el tiempo total de la sesión, descanso incluido.
```

Create `src/content/activities/natacion-estilo-libre.md`:

```
---
name: Natación — estilo libre
discipline: natacion
metricType: session
---

Nado continuo en estilo libre (crol). Registrá la distancia total nadada y el tiempo de la sesión.
```

Create `src/content/activities/combate-boxeo-clase.md`:

```
---
name: Boxeo — clase
discipline: combate
metricType: session
---

Clase grupal o entrenamiento de boxeo (técnica, guantes, sparring liviano). Registrá la duración total de la sesión.
```

Create `src/content/activities/combate-muay-thai-clase.md`:

```
---
name: Muay Thai — clase
discipline: combate
metricType: session
---

Clase de muay thai (técnica, clinch, sparring). Registrá la duración total de la sesión.
```

- [ ] **Step 5: Update `src/pages/ejercicios/index.astro`**

Replace the frontmatter (everything between the `---` fences) with:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import MuscleExplorer from '../../components/react/MuscleExplorer/MuscleExplorer';
import { getCollection } from 'astro:content';
import { isGymActivity } from '../../lib/activities';

const activityEntries = await getCollection('activities');
const exercises = activityEntries
  .filter(isGymActivity)
  .map((e) => ({
    id: e.id,
    name: e.data.name,
    equipment: e.data.equipment,
    instructions: e.body?.trim() ?? '',
    muscles: e.data.muscles,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
---
<BaseLayout title="Ejercicios">
  <p class="label-brutal mb-3 text-acid">Explora por músculo</p>
  <h1 class="mb-8 font-display text-5xl text-paper sm:text-6xl">EJERCICIOS</h1>
  <MuscleExplorer client:load exercises={exercises} />
</BaseLayout>
```

Only the collection name and the added `isGymActivity` filter changed — `MuscleExplorer` keeps receiving the exact same prop shape it does today.

- [ ] **Step 6: Update `src/pages/registro/nuevo.astro`**

Replace the frontmatter with:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import WorkoutLogger from '../../components/react/WorkoutLogger/WorkoutLogger';
import { getCollection } from 'astro:content';
import { isGymActivity } from '../../lib/activities';
import { muscleLabel } from '../../lib/muscles';

const activityEntries = await getCollection('activities');
const exercises = activityEntries
  .filter(isGymActivity)
  .map((e) => ({
    id: e.id,
    name: e.data.name,
    muscleGroup: e.data.muscles.map((m) => muscleLabel(m)).join(', '),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const planEntries = await getCollection('plans');
const plans = planEntries.map((p) => ({ id: p.id, days: p.data.days }));
---
<BaseLayout title="Registrar entrenamiento">
  <p class="label-brutal mb-3 text-acid">Sesión de hoy</p>
  <h1 class="mb-8 font-display text-5xl text-paper sm:text-6xl">REGISTRAR ENTRENAMIENTO</h1>
  <WorkoutLogger client:load exercises={exercises} plans={plans} />
</BaseLayout>
```

`WorkoutLogger` isn't touched in this task, so its prop is still named `exercises` — this is deliberately filtered to gym-only for now (Task 6 replaces this whole block to pass the full multi-discipline catalog once `WorkoutLogger` can render it).

- [ ] **Step 7: Update `src/pages/rutinas/index.astro`**

Replace the frontmatter with:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import RoutineManager from '../../components/react/RoutineManager/RoutineManager';
import { getCollection } from 'astro:content';
import { isGymActivity } from '../../lib/activities';

const planEntries = await getCollection('plans');
const predefinedRoutines = planEntries
  .map((p) => ({
    id: p.id,
    name: p.data.name,
    goal: p.data.goal,
    level: p.data.level,
    days: p.data.days,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const activityEntries = await getCollection('activities');
const exercises = activityEntries
  .filter(isGymActivity)
  .map((e) => ({ id: e.id, name: e.data.name }))
  .sort((a, b) => a.name.localeCompare(b.name));
---
<BaseLayout title="Rutinas">
  <p class="label-brutal mb-3 text-acid">Elegí o armá tu plan</p>
  <h1 class="mb-8 font-display text-5xl text-paper sm:text-6xl">RUTINAS</h1>
  <RoutineManager client:load predefinedRoutines={predefinedRoutines} exercises={exercises} />
</BaseLayout>
```

Same reasoning as Step 6 — Task 7 replaces this block once `RoutineManager`/`CreateRoutineForm` can build mixed-discipline days.

- [ ] **Step 8: Update `src/pages/progreso/index.astro`**

Replace the frontmatter with:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import ProgressList from '../../components/react/ProgressList/ProgressList';
import { getCollection } from 'astro:content';
import { isGymActivity } from '../../lib/activities';

const activityEntries = await getCollection('activities');
const gymEntries = activityEntries.filter(isGymActivity);
const exerciseNames = Object.fromEntries(gymEntries.map((e) => [e.id, e.data.name]));
const exercises = gymEntries.map((e) => ({
  id: e.id,
  name: e.data.name,
  muscle: e.data.muscles[0],
}));
---
<BaseLayout title="Progreso">
  <p class="label-brutal mb-3 text-acid">Tu bitácora</p>
  <h1 class="mb-8 font-display text-5xl text-paper sm:text-6xl">HISTORIAL</h1>
  <ProgressList client:load exerciseNames={exerciseNames} exercises={exercises} />
</BaseLayout>
```

Filtering to gym-only here isn't optional the way it was for `rutinas/index.astro` — `e.data.muscles[0]` would throw on a session-type entry, since that field doesn't exist on that branch of the union. Task 9 adds the `activities` prop back for the cardio side.

- [ ] **Step 9: Verify the build**

Run: `npm run build`
Expected: `7 page(s) built`, no errors — identical page count to before this task. Visiting `/ejercicios/`, `/registro/nuevo/`, `/rutinas/`, `/progreso/` in a preview server should look and behave exactly as before.

- [ ] **Step 10: Commit**

```bash
git add src/content.config.ts src/lib/activities.ts src/content/activities src/pages/ejercicios/index.astro src/pages/registro/nuevo.astro src/pages/rutinas/index.astro src/pages/progreso/index.astro
git status
```

Confirm `src/content/exercises/` no longer appears in `git status` (the `git mv` already staged the moves) and that all 37 files under `src/content/activities/` are staged, then:

```bash
git commit -m "feat: rename exercises content collection to activities"
```

---

### Task 2: `workout_sessions` table

**Files:**
- Modify: `src/types/db.ts`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Add the `WorkoutSession` type**

`src/types/db.ts` currently ends after `ActiveRoutine`. Add at the end:

```ts
export interface WorkoutSession {
  id: string;
  workout_id: string;
  activity_id: string;
  duration_min: number;
  distance_km: number | null;
  created_at: string;
}
```

- [ ] **Step 2: Append the table to the schema file**

Add to the end of `supabase/schema.sql`:

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

`distance_km` has no `not null` — combate sessions leave it as `null`, running/natación always fill it (enforced client-side, not at the DB level, same trust level as the rest of this schema). No uniqueness constraint, unlike `workout_sets`: there's no "set number" concept here, and nothing stops logging the same activity twice in one day (e.g. a morning and an evening run).

- [ ] **Step 3: Apply the migration to the real Supabase project**

⚠️ This step touches the live Supabase database, not just repo files. Same situation as the `routines`/`active_routines` migration: this repo has no `supabase/migrations/` folder, so `supabase/schema.sql` is a manually-applied reference. Before running anything, get explicit authorization to modify the live database, then either:

- Paste the SQL from Step 2 into the Supabase dashboard's SQL Editor for this project and run it, or
- If you have CLI access: `supabase link --project-ref <ref>` (get `<ref>` from `supabase projects list`, matching the project this repo's `.env` `PUBLIC_SUPABASE_URL` points at) and run the SQL via `supabase db execute --file <(echo '<the SQL from Step 2>')` — do not run `supabase db push`, there's no migrations directory backing it.

- [ ] **Step 4: Verify the table exists**

In the Supabase SQL Editor (or via `psql`):

```sql
select * from workout_sessions limit 1;
```

Expected: 0 rows, no error.

- [ ] **Step 5: Verify the app still builds**

Run: `npm run build`
Expected: build completes cleanly (this task only touches types and SQL; nothing imports `WorkoutSession` yet).

- [ ] **Step 6: Commit**

```bash
git add src/types/db.ts supabase/schema.sql
git commit -m "feat: add workout_sessions table"
```

---

### Task 3: `addSession` / `getSessionsForWorkout`

**Files:**
- Modify: `src/lib/workouts.ts`

- [ ] **Step 1: Add the two functions**

`src/lib/workouts.ts` currently ends after `getSetsForWorkout`. Add at the end:

```ts
export async function addSession(
  workoutId: string,
  activityId: string,
  durationMin: number,
  distanceKm?: number
): Promise<WorkoutSession> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({
      workout_id: workoutId,
      activity_id: activityId,
      duration_min: durationMin,
      distance_km: distanceKm ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as WorkoutSession;
}

export async function getSessionsForWorkout(workoutId: string): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as WorkoutSession[];
}
```

Update the top import line from:

```ts
import type { Workout, WorkoutSet } from '../types/db';
```

to:

```ts
import type { Workout, WorkoutSet, WorkoutSession } from '../types/db';
```

Same style as `addSet`/`getSetsForWorkout` right above: no redundant auth check inside `addSession` (the RLS policy plus the fact that `workoutId` only ever comes from a workout `createWorkout` just made under the current session covers it), and `getSessionsForWorkout` mirrors `getSetsForWorkout` exactly except it orders by `created_at` instead of `exercise_id, set_number` — there's no natural ordering key for sessions since there's no "set number".

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build completes cleanly. Nothing calls `addSession`/`getSessionsForWorkout` yet.

- [ ] **Step 3: Commit**

```bash
git add src/lib/workouts.ts
git commit -m "feat: add addSession and getSessionsForWorkout"
```

---

### Task 4: Cardio PR and progress aggregation functions

**Files:**
- Modify: `src/lib/prs.ts`

- [ ] **Step 1: Add the new types and functions**

`src/lib/prs.ts` currently ends after `groupPRsByMuscle`. First update the top import line from:

```ts
import type { Workout, WorkoutSet } from '../types/db';
```

to:

```ts
import type { Workout, WorkoutSet, WorkoutSession } from '../types/db';
```

Then add at the end of the file:

```ts
export interface WorkoutWithSessions extends Workout {
  sessions: WorkoutSession[];
}

export interface CardioPR {
  activityId: string;
  paceMinPerKm: number;
  date: string;
}

export interface CardioProgressPoint {
  date: string;
  paceMinPerKm: number;
}

export interface DisciplineGroup {
  discipline: string;
  entries: CardioPR[];
}

// For each activity_id, the fastest pace (lowest duration_min / distance_km)
// ever logged. Sessions with no distance (combate) never produce a pace and
// are skipped entirely — there's no "record" for a duration-only session.
export function calculateCardioPRs(workouts: WorkoutWithSessions[]): CardioPR[] {
  const prsByActivity = new Map<string, CardioPR>();
  for (const workout of workouts) {
    for (const session of workout.sessions) {
      if (session.distance_km === null) continue;
      const pace = session.duration_min / session.distance_km;
      const current = prsByActivity.get(session.activity_id);
      if (!current || pace < current.paceMinPerKm) {
        prsByActivity.set(session.activity_id, {
          activityId: session.activity_id,
          paceMinPerKm: pace,
          date: workout.date,
        });
      }
    }
  }
  return Array.from(prsByActivity.values());
}

// For ONE activity_id, one point per date with that day's fastest pace,
// sorted chronologically. Mirrors progressForExercise.
export function progressForCardioActivity(
  workouts: WorkoutWithSessions[],
  activityId: string
): CardioProgressPoint[] {
  const bestPaceByDate = new Map<string, number>();
  for (const workout of workouts) {
    for (const session of workout.sessions) {
      if (session.activity_id !== activityId || session.distance_km === null) continue;
      const pace = session.duration_min / session.distance_km;
      const current = bestPaceByDate.get(workout.date);
      if (current === undefined || pace < current) {
        bestPaceByDate.set(workout.date, pace);
      }
    }
  }
  return Array.from(bestPaceByDate.entries())
    .map(([date, paceMinPerKm]) => ({ date, paceMinPerKm }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// A PR whose activity_id isn't in the current activities collection (e.g. an
// activity later renamed or removed) falls into this bucket instead of
// disappearing — same fallback as groupPRsByMuscle for gym.
const UNKNOWN_DISCIPLINE = 'Otros';

// Groups cardio PRs by discipline ('running' | 'natacion'), skipping
// disciplines with no PRs. Combate never appears here (calculateCardioPRs
// already excludes it).
export function groupCardioPRsByDiscipline(
  prs: CardioPR[],
  activities: { id: string; discipline: string }[]
): DisciplineGroup[] {
  const disciplineByActivityId = new Map(activities.map((a) => [a.id, a.discipline]));
  const entriesByDiscipline = new Map<string, CardioPR[]>();
  for (const pr of prs) {
    const discipline = disciplineByActivityId.get(pr.activityId) ?? UNKNOWN_DISCIPLINE;
    const list = entriesByDiscipline.get(discipline) ?? [];
    list.push(pr);
    entriesByDiscipline.set(discipline, list);
  }
  const order = ['running', 'natacion'];
  const knownGroups = order
    .filter((d) => entriesByDiscipline.has(d))
    .map((d) => ({ discipline: d, entries: entriesByDiscipline.get(d)! }));
  const unknownEntries = entriesByDiscipline.get(UNKNOWN_DISCIPLINE);
  return unknownEntries
    ? [...knownGroups, { discipline: UNKNOWN_DISCIPLINE, entries: unknownEntries }]
    : knownGroups;
}

// Formats a pace in minutes-per-km as "M:SS /km" (e.g. 5.5 -> "5:30 /km").
export function formatPace(paceMinPerKm: number): string {
  const totalSeconds = Math.round(paceMinPerKm * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
}
```

`calculatePRs`, `progressForExercise`, and `groupPRsByMuscle` above this are untouched — these are new, separate functions operating on `WorkoutWithSessions` instead of `WorkoutWithSets`.

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build completes cleanly. Nothing imports the new functions yet.

- [ ] **Step 3: Commit**

```bash
git add src/lib/prs.ts
git commit -m "feat: add cardio PR and progress aggregation functions"
```

---

### Task 5: `ActivityPicker` shared component

**Files:**
- Create: `src/components/react/ActivityPicker/ActivityPicker.tsx`

- [ ] **Step 1: Write the file**

```tsx
import { useEffect, useState } from 'react';

export interface ActivityOption {
  id: string;
  name: string;
  discipline: 'gym' | 'running' | 'natacion' | 'combate';
  metricType: 'sets' | 'session';
}

export const DISCIPLINES: { id: ActivityOption['discipline']; label: string }[] = [
  { id: 'gym', label: 'Gym' },
  { id: 'running', label: 'Running' },
  { id: 'natacion', label: 'Natación' },
  { id: 'combate', label: 'Combate' },
];

interface Props {
  activities: ActivityOption[];
  onSelect: (activity: ActivityOption | null) => void;
}

export default function ActivityPicker({ activities, onSelect }: Props) {
  const [discipline, setDiscipline] = useState<ActivityOption['discipline']>('gym');
  const filtered = activities.filter((a) => a.discipline === discipline);
  const [selectedId, setSelectedId] = useState(filtered[0]?.id ?? '');

  useEffect(() => {
    onSelect(filtered.find((a) => a.id === selectedId) ?? null);
  }, [selectedId]);

  function handleDisciplineChange(next: ActivityOption['discipline']) {
    setDiscipline(next);
    const nextFiltered = activities.filter((a) => a.discipline === next);
    setSelectedId(nextFiltered[0]?.id ?? '');
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {DISCIPLINES.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => handleDisciplineChange(d.id)}
            className={
              d.id === discipline
                ? 'btn-brutal-sm border-acid bg-acid text-ink'
                : 'btn-brutal-sm opacity-60'
            }
          >
            {d.label}
          </button>
        ))}
      </div>
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="input-brutal"
      >
        {filtered.length === 0 ? (
          <option value="">Sin actividades en esta disciplina</option>
        ) : (
          filtered.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
```

`ActivityPicker` is deliberately "dumb" about what selecting an activity *means* — it only ever reports "this is the currently selected activity" via `onSelect`, called both when switching tabs (auto-selects the first activity of the new discipline) and when changing the dropdown. `WorkoutLogger` (Task 6) treats that as "update the preview form below"; `CreateRoutineForm` (Task 7) pairs it with its own explicit "+ Agregar" button rather than treating selection itself as an add — switching tabs must never silently add something to a routine day.

The `useEffect` fires once on mount (reporting the initial default) and again whenever `selectedId` changes — it intentionally does not depend on `filtered`/`onSelect` (both are recreated every render), only on the primitive `selectedId`, otherwise it would re-fire on every render.

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build completes cleanly. Nothing imports this component yet.

- [ ] **Step 3: Commit**

```bash
git add src/components/react/ActivityPicker/ActivityPicker.tsx
git commit -m "feat: add shared ActivityPicker component"
```

---

### Task 6: Multi-discipline `WorkoutLogger`

**Files:**
- Modify: `src/components/react/WorkoutLogger/WorkoutLogger.tsx` (full replacement)
- Modify: `src/pages/registro/nuevo.astro`

- [ ] **Step 1: Replace `WorkoutLogger.tsx` in full**

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import { createWorkout, addSet, addSession } from '../../../lib/workouts';
import { getActiveRoutine, getRoutineById } from '../../../lib/routines';
import { getTodayWeekday, type RoutineDays } from '../../../lib/weekdays';
import ActivityPicker, { type ActivityOption } from '../ActivityPicker/ActivityPicker';

interface PredefinedRoutine {
  id: string;
  days: RoutineDays;
}

interface LoggedSet {
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  reps: number;
  weight: number;
  rpe: number | null;
}

interface LoggedSession {
  activityId: string;
  activityName: string;
  durationMin: number;
  distanceKm: number | null;
}

interface Props {
  activities: ActivityOption[];
  plans: PredefinedRoutine[];
}

interface ParsedSet {
  reps: number;
  weight: number;
  rpe: number | null;
}

interface ParsedSession {
  durationMin: number;
  distanceKm: number | null;
}

function parseSetInput(reps: string, weight: string, rpe: string): ParsedSet | { error: string } {
  const repsNum = Number(reps);
  const weightNum = Number(weight);
  const rpeNum = rpe === '' ? null : Number(rpe);

  if (!Number.isFinite(repsNum) || repsNum <= 0) {
    return { error: 'Las repeticiones deben ser un número mayor a 0.' };
  }
  if (!Number.isFinite(weightNum) || weightNum < 0) {
    return { error: 'El peso debe ser un número válido.' };
  }
  if (rpeNum !== null && (!Number.isFinite(rpeNum) || rpeNum < 0 || rpeNum > 10)) {
    return { error: 'El RPE debe ser un número entre 0 y 10.' };
  }
  return { reps: repsNum, weight: weightNum, rpe: rpeNum };
}

function parseSessionInput(
  duration: string,
  distance: string,
  requiresDistance: boolean
): ParsedSession | { error: string } {
  const durationNum = Number(duration);
  if (!Number.isFinite(durationNum) || durationNum <= 0) {
    return { error: 'La duración debe ser un número mayor a 0.' };
  }
  if (!requiresDistance) {
    return { durationMin: durationNum, distanceKm: null };
  }
  const distanceNum = Number(distance);
  if (!Number.isFinite(distanceNum) || distanceNum <= 0) {
    return { error: 'La distancia debe ser un número mayor a 0.' };
  }
  return { durationMin: durationNum, distanceKm: distanceNum };
}

function SetFields({
  reps,
  weight,
  rpe,
  onRepsChange,
  onWeightChange,
  onRpeChange,
}: {
  reps: string;
  weight: string;
  rpe: string;
  onRepsChange: (v: string) => void;
  onWeightChange: (v: string) => void;
  onRpeChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <label className="flex flex-col gap-2">
        <span className="label-brutal">Reps</span>
        <input
          type="number"
          value={reps}
          onChange={(e) => onRepsChange(e.target.value)}
          min={1}
          required
          className="input-brutal"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="label-brutal">Peso (kg)</span>
        <input
          type="number"
          value={weight}
          onChange={(e) => onWeightChange(e.target.value)}
          min={0}
          step="0.5"
          required
          className="input-brutal"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="label-brutal">RPE</span>
        <input
          type="number"
          value={rpe}
          onChange={(e) => onRpeChange(e.target.value)}
          min={0}
          max={10}
          step="0.5"
          className="input-brutal"
        />
      </label>
    </div>
  );
}

function SessionFields({
  duration,
  distance,
  requiresDistance,
  onDurationChange,
  onDistanceChange,
}: {
  duration: string;
  distance: string;
  requiresDistance: boolean;
  onDurationChange: (v: string) => void;
  onDistanceChange: (v: string) => void;
}) {
  return (
    <div className={requiresDistance ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3'}>
      {requiresDistance && (
        <label className="flex flex-col gap-2">
          <span className="label-brutal">Distancia (km)</span>
          <input
            type="number"
            value={distance}
            onChange={(e) => onDistanceChange(e.target.value)}
            min={0}
            step="0.1"
            required
            className="input-brutal"
          />
        </label>
      )}
      <label className="flex flex-col gap-2">
        <span className="label-brutal">Tiempo (min)</span>
        <input
          type="number"
          value={duration}
          onChange={(e) => onDurationChange(e.target.value)}
          min={0}
          step="1"
          required
          className="input-brutal"
        />
      </label>
    </div>
  );
}

function RoutineActivityCard({
  activity,
  onAddSet,
  onAddSession,
}: {
  activity: ActivityOption;
  onAddSet: (activityId: string, activityName: string, parsed: ParsedSet) => void;
  onAddSession: (activityId: string, activityName: string, parsed: ParsedSession) => void;
}) {
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [rpe, setRpe] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (activity.metricType === 'sets') {
      const parsed = parseSetInput(reps, weight, rpe);
      if ('error' in parsed) {
        setError(parsed.error);
        return;
      }
      setError(null);
      onAddSet(activity.id, activity.name, parsed);
      setReps('');
      setWeight('');
      setRpe('');
    } else {
      const requiresDistance = activity.discipline !== 'combate';
      const parsed = parseSessionInput(duration, distance, requiresDistance);
      if ('error' in parsed) {
        setError(parsed.error);
        return;
      }
      setError(null);
      onAddSession(activity.id, activity.name, parsed);
      setDuration('');
      setDistance('');
    }
  }

  return (
    <form onSubmit={handleAdd} className="card-brutal flex flex-col gap-3">
      <p className="font-display text-xl text-paper">{activity.name}</p>
      {activity.metricType === 'sets' ? (
        <SetFields
          reps={reps}
          weight={weight}
          rpe={rpe}
          onRepsChange={setReps}
          onWeightChange={setWeight}
          onRpeChange={setRpe}
        />
      ) : (
        <SessionFields
          duration={duration}
          distance={distance}
          requiresDistance={activity.discipline !== 'combate'}
          onDurationChange={setDuration}
          onDistanceChange={setDistance}
        />
      )}
      {error && <p className="font-mono text-xs text-blood">{error}</p>}
      <button type="submit" className="btn-brutal-sm self-start">
        {activity.metricType === 'sets' ? '+ Agregar serie' : '+ Agregar sesión'}
      </button>
    </form>
  );
}

export default function WorkoutLogger({ activities, plans }: Props) {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loggedSets, setLoggedSets] = useState<LoggedSet[]>([]);
  const [loggedSessions, setLoggedSessions] = useState<LoggedSession[]>([]);
  const [planId, setPlanId] = useState<string | undefined>(undefined);
  const [todayActivities, setTodayActivities] = useState<ActivityOption[]>([]);

  const [selectedActivity, setSelectedActivity] = useState<ActivityOption | null>(null);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [rpe, setRpe] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const loggedIn = data.session !== null;
      setIsLoggedIn(loggedIn);
      setAuthChecked(true);
      if (!loggedIn) return;

      const active = await getActiveRoutine();
      if (!active) return;
      setPlanId(active.routine_ref);

      const today = getTodayWeekday();
      let ids: string[] = [];
      if (active.source === 'predefined') {
        const plan = plans.find((p) => p.id === active.routine_ref);
        ids = plan?.days[today] ?? [];
      } else {
        const routine = await getRoutineById(active.routine_ref);
        ids = routine?.days[today] ?? [];
      }
      setTodayActivities(
        ids
          .map((id) => activities.find((a) => a.id === id))
          .filter((a): a is ActivityOption => a !== undefined)
      );
    });
  }, [plans, activities]);

  function addLoggedSet(activityId: string, activityName: string, parsed: ParsedSet) {
    const setNumber = loggedSets.filter((s) => s.exerciseId === activityId).length + 1;
    setLoggedSets((prev) => [
      ...prev,
      { exerciseId: activityId, exerciseName: activityName, setNumber, ...parsed },
    ]);
  }

  function addLoggedSession(activityId: string, activityName: string, parsed: ParsedSession) {
    setLoggedSessions((prev) => [...prev, { activityId, activityName, ...parsed }]);
  }

  function handleAddActivity(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMessage(null);

    if (!selectedActivity) {
      setError('Elige una actividad.');
      return;
    }

    if (selectedActivity.metricType === 'sets') {
      const parsed = parseSetInput(reps, weight, rpe);
      if ('error' in parsed) {
        setError(parsed.error);
        return;
      }
      addLoggedSet(selectedActivity.id, selectedActivity.name, parsed);
      setReps('');
      setWeight('');
      setRpe('');
    } else {
      const requiresDistance = selectedActivity.discipline !== 'combate';
      const parsed = parseSessionInput(duration, distance, requiresDistance);
      if ('error' in parsed) {
        setError(parsed.error);
        return;
      }
      addLoggedSession(selectedActivity.id, selectedActivity.name, parsed);
      setDuration('');
      setDistance('');
    }
  }

  function handleRemoveSet(index: number) {
    setLoggedSets((prev) => {
      const removed = prev[index];
      const withoutRemoved = prev.filter((_, i) => i !== index);
      let nextNumber = 1;
      return withoutRemoved.map((s) =>
        s.exerciseId === removed.exerciseId ? { ...s, setNumber: nextNumber++ } : s
      );
    });
  }

  function handleRemoveSession(index: number) {
    setLoggedSessions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveWorkout() {
    if (loggedSets.length === 0 && loggedSessions.length === 0) {
      setError('Agrega al menos una serie o sesión antes de guardar.');
      return;
    }
    setError(null);
    setSavedMessage(null);
    setSaving(true);
    try {
      const workout = await createWorkout(date, undefined, planId);
      for (const s of loggedSets) {
        await addSet(workout.id, s.exerciseId, s.setNumber, s.reps, s.weight, s.rpe ?? undefined);
      }
      for (const s of loggedSessions) {
        await addSession(workout.id, s.activityId, s.durationMin, s.distanceKm ?? undefined);
      }
      setSavedMessage('Entrenamiento guardado correctamente.');
      setLoggedSets([]);
      setLoggedSessions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el entrenamiento.');
    } finally {
      setSaving(false);
    }
  }

  if (!authChecked) {
    return <p className="font-mono text-sm text-paper-dim">Cargando...</p>;
  }

  if (!isLoggedIn) {
    return (
      <p className="font-mono text-sm text-paper-dim">
        Debes{' '}
        <a
          href={`${import.meta.env.BASE_URL}login/`}
          className="text-acid underline underline-offset-4 hover:text-paper"
        >
          iniciar sesión
        </a>{' '}
        para registrar un entrenamiento.
      </p>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <label className="flex max-w-xs flex-col gap-2">
        <span className="label-brutal">Fecha</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input-brutal"
        />
      </label>

      {todayActivities.length > 0 && (
        <div className="flex flex-col gap-4">
          <p className="label-brutal text-acid">Hoy toca</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {todayActivities.map((activity) => (
              <RoutineActivityCard
                key={activity.id}
                activity={activity}
                onAddSet={addLoggedSet}
                onAddSession={addLoggedSession}
              />
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleAddActivity} className="card-brutal flex flex-col gap-4">
        <p className="label-brutal text-acid">Agregar otra actividad</p>
        <ActivityPicker activities={activities} onSelect={setSelectedActivity} />
        {selectedActivity?.metricType === 'sets' && (
          <SetFields
            reps={reps}
            weight={weight}
            rpe={rpe}
            onRepsChange={setReps}
            onWeightChange={setWeight}
            onRpeChange={setRpe}
          />
        )}
        {selectedActivity?.metricType === 'session' && (
          <SessionFields
            duration={duration}
            distance={distance}
            requiresDistance={selectedActivity.discipline !== 'combate'}
            onDurationChange={setDuration}
            onDistanceChange={setDistance}
          />
        )}
        <button type="submit" className="btn-brutal-sm self-start">
          + Agregar
        </button>
      </form>

      {loggedSets.length > 0 && (
        <div className="overflow-x-auto border-2 border-paper-dim/30">
          <table className="w-full min-w-[480px] text-left font-mono text-sm">
            <thead>
              <tr className="border-b-2 border-acid text-xs uppercase tracking-[0.15em] text-paper-dim">
                <th className="px-3 py-2 font-normal">Ejercicio</th>
                <th className="px-3 py-2 font-normal">Serie</th>
                <th className="px-3 py-2 font-normal">Reps</th>
                <th className="px-3 py-2 font-normal">Peso</th>
                <th className="px-3 py-2 font-normal">RPE</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loggedSets.map((s, i) => (
                <tr key={i} className="border-b border-paper-dim/20">
                  <td className="px-3 py-2 font-body text-paper">{s.exerciseName}</td>
                  <td className="px-3 py-2 text-acid">{s.setNumber}</td>
                  <td className="px-3 py-2">{s.reps}</td>
                  <td className="px-3 py-2">{s.weight}</td>
                  <td className="px-3 py-2">{s.rpe ?? '—'}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleRemoveSet(i)}
                      className="text-blood hover:text-paper"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loggedSessions.length > 0 && (
        <div className="overflow-x-auto border-2 border-paper-dim/30">
          <table className="w-full min-w-[420px] text-left font-mono text-sm">
            <thead>
              <tr className="border-b-2 border-acid text-xs uppercase tracking-[0.15em] text-paper-dim">
                <th className="px-3 py-2 font-normal">Actividad</th>
                <th className="px-3 py-2 font-normal">Distancia</th>
                <th className="px-3 py-2 font-normal">Tiempo</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loggedSessions.map((s, i) => (
                <tr key={i} className="border-b border-paper-dim/20">
                  <td className="px-3 py-2 font-body text-paper">{s.activityName}</td>
                  <td className="px-3 py-2">
                    {s.distanceKm !== null ? `${s.distanceKm} km` : '—'}
                  </td>
                  <td className="px-3 py-2">{s.durationMin} min</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleRemoveSession(i)}
                      className="text-blood hover:text-paper"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
      {savedMessage && (
        <p className="border-l-2 border-acid pl-3 font-mono text-sm text-acid">{savedMessage}</p>
      )}

      <button
        type="button"
        onClick={handleSaveWorkout}
        disabled={saving}
        className="btn-brutal self-start"
      >
        {saving ? 'Guardando...' : 'Guardar entrenamiento'}
      </button>
    </div>
  );
}
```

Behavior notes:
- The `Props` interface's field is renamed from `exercises` to `activities` — Step 2 below updates the page accordingly.
- "Hoy toca" ids that don't resolve to a known activity (e.g. a routine referencing a deleted activity) are silently dropped from `todayActivities` via the `filter((a): a is ActivityOption => ...)` — this is a small behavior change from before (previously an unresolved id still rendered a card labelled with the raw id): a session vs. sets card can't be decided for an unknown id, so there's nothing sensible to render.
- Two independent tables render logged sets and logged sessions — never one table with columns that don't always apply.

- [ ] **Step 2: Update `src/pages/registro/nuevo.astro`**

Replace the frontmatter with:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import WorkoutLogger from '../../components/react/WorkoutLogger/WorkoutLogger';
import { getCollection } from 'astro:content';

const activityEntries = await getCollection('activities');
const activities = activityEntries
  .map((e) => ({
    id: e.id,
    name: e.data.name,
    discipline: e.data.discipline,
    metricType: e.data.metricType,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const planEntries = await getCollection('plans');
const plans = planEntries.map((p) => ({ id: p.id, days: p.data.days }));
---
<BaseLayout title="Registrar entrenamiento">
  <p class="label-brutal mb-3 text-acid">Sesión de hoy</p>
  <h1 class="mb-8 font-display text-5xl text-paper sm:text-6xl">REGISTRAR ENTRENAMIENTO</h1>
  <WorkoutLogger client:load activities={activities} plans={plans} />
</BaseLayout>
```

`e.data.discipline` and `e.data.metricType` are readable without any type predicate — both fields exist on every branch of the discriminated union, so TypeScript doesn't need narrowing to access them.

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: `7 page(s) built`, no errors.

- [ ] **Step 4: Manual smoke check**

```bash
npx astro preview --port 4322
```

Log in (any existing test account, or create one — see Task 10 for the throwaway-account pattern) and open `/registro/nuevo/`. Confirm: the "Agregar otra actividad" card shows discipline tabs (Gym/Running/Natación/Combate); Gym shows reps/peso/RPE fields; Running/Natación show distancia+tiempo; Combate shows only tiempo (no distancia field at all). Add one of each, confirm they land in two separate tables ("Series registradas" pattern for gym, a new table for sessions) with a working "Quitar" button on each.

- [ ] **Step 5: Commit**

```bash
git add src/components/react/WorkoutLogger/WorkoutLogger.tsx src/pages/registro/nuevo.astro
git commit -m "feat: log multi-discipline activities in WorkoutLogger"
```

---

### Task 7: Mixed-discipline routine builder

**Files:**
- Modify: `src/components/react/RoutineManager/CreateRoutineForm.tsx` (full replacement)
- Modify: `src/components/react/RoutineManager/RoutineList.tsx` (full replacement)
- Modify: `src/components/react/RoutineManager/RoutineManager.tsx` (full replacement)
- Modify: `src/pages/rutinas/index.astro`

- [ ] **Step 1: Replace `CreateRoutineForm.tsx` in full**

The native `<select multiple>` per weekday is replaced with `ActivityPicker` + an explicit "+ Agregar" button + a removable chip list, so a day can mix disciplines (switching tabs must never silently add anything — see Task 5's note on `ActivityPicker`).

```tsx
import { useState, type FormEvent } from 'react';
import { WEEKDAYS, weekdayLabel, type RoutineDays } from '../../../lib/weekdays';
import { createRoutine } from '../../../lib/routines';
import ActivityPicker, { type ActivityOption } from '../ActivityPicker/ActivityPicker';

interface Props {
  activities: ActivityOption[];
  onCreated: () => void;
}

function emptyDays(): RoutineDays {
  return {
    lunes: [],
    martes: [],
    miercoles: [],
    jueves: [],
    viernes: [],
    sabado: [],
    domingo: [],
  };
}

function DayActivityPicker({
  activities,
  dayIds,
  onAdd,
  onRemove,
}: {
  activities: ActivityOption[];
  dayIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [selected, setSelected] = useState<ActivityOption | null>(null);
  const activityById = new Map(activities.map((a) => [a.id, a]));

  return (
    <div className="flex flex-col gap-2">
      <ActivityPicker activities={activities} onSelect={setSelected} />
      <button
        type="button"
        onClick={() => selected && onAdd(selected.id)}
        disabled={!selected}
        className="btn-brutal-sm self-start"
      >
        + Agregar
      </button>
      {dayIds.length > 0 && (
        <ul className="flex flex-col gap-1 font-mono text-sm">
          {dayIds.map((id) => (
            <li key={id} className="flex items-center justify-between gap-2 text-paper-dim">
              <span>{activityById.get(id)?.name ?? id}</span>
              <button
                type="button"
                onClick={() => onRemove(id)}
                className="text-blood hover:text-paper"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CreateRoutineForm({ activities, onCreated }: Props) {
  const [name, setName] = useState('');
  const [days, setDays] = useState<RoutineDays>(emptyDays());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAddToDay(day: keyof RoutineDays, id: string) {
    setDays((prev) => {
      if (prev[day].includes(id)) return prev;
      return { ...prev, [day]: [...prev[day], id] };
    });
  }

  function handleRemoveFromDay(day: keyof RoutineDays, id: string) {
    setDays((prev) => ({ ...prev, [day]: prev[day].filter((existing) => existing !== id) }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Ponele un nombre a la rutina.');
      return;
    }

    setSaving(true);
    try {
      await createRoutine(name.trim(), days);
      setName('');
      setDays(emptyDays());
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la rutina.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-brutal flex flex-col gap-4">
      <p className="label-brutal text-acid">Crear rutina</p>
      <label className="flex flex-col gap-2">
        <span className="label-brutal">Nombre</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-brutal"
        />
      </label>
      <div className="grid gap-6 sm:grid-cols-2">
        {WEEKDAYS.map((day) => (
          <div key={day} className="flex flex-col gap-2">
            <span className="label-brutal">{weekdayLabel(day)}</span>
            <DayActivityPicker
              activities={activities}
              dayIds={days[day]}
              onAdd={(id) => handleAddToDay(day, id)}
              onRemove={(id) => handleRemoveFromDay(day, id)}
            />
          </div>
        ))}
      </div>
      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}
      <button type="submit" disabled={saving} className="btn-brutal self-start">
        {saving ? 'Guardando...' : 'Guardar rutina'}
      </button>
    </form>
  );
}
```

`handleAddToDay` guards against adding the same id twice — the old native multi-select made that structurally impossible, so this preserves that guarantee under the new add-button interaction.

- [ ] **Step 2: Replace `RoutineList.tsx` in full**

Only the prop name/type changes (`exercises: ExerciseOption[]` → `activities: ActivityOption[]`) — logic is identical.

```tsx
import { useState } from 'react';
import { WEEKDAYS, weekdayLabel, type RoutineDays } from '../../../lib/weekdays';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';

export interface RoutineOption {
  ref: string;
  name: string;
  subtitle?: string;
  days: RoutineDays;
}

interface RoutineListProps {
  title: string;
  source: 'predefined' | 'custom';
  routines: RoutineOption[];
  activities: ActivityOption[];
  emptyMessage: string;
  onActivate: (source: 'predefined' | 'custom', ref: string, weeks: number) => void;
}

function daysSummary(days: RoutineDays, activities: ActivityOption[]): string {
  return WEEKDAYS.filter((day) => days[day].length > 0)
    .map((day) => {
      const names = days[day].map((id) => activities.find((a) => a.id === id)?.name ?? id);
      return `${weekdayLabel(day)}: ${names.join(', ')}`;
    })
    .join(' · ');
}

function RoutineCard({
  routine,
  source,
  activities,
  onActivate,
}: {
  routine: RoutineOption;
  source: 'predefined' | 'custom';
  activities: ActivityOption[];
  onActivate: (source: 'predefined' | 'custom', ref: string, weeks: number) => void;
}) {
  const [weeks, setWeeks] = useState('8');

  return (
    <div className="card-brutal flex flex-col gap-3">
      <div>
        <p className="font-display text-2xl text-paper">{routine.name}</p>
        {routine.subtitle && <p className="label-brutal">{routine.subtitle}</p>}
      </div>
      <p className="font-mono text-sm text-paper-dim">{daysSummary(routine.days, activities)}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={weeks}
          onChange={(e) => setWeeks(e.target.value)}
          min={1}
          className="input-brutal w-20"
        />
        <span className="label-brutal">semanas</span>
        <button
          type="button"
          onClick={() => onActivate(source, routine.ref, Number(weeks))}
          className="btn-brutal-sm ml-auto"
        >
          Activar
        </button>
      </div>
    </div>
  );
}

export default function RoutineList({
  title,
  source,
  routines,
  activities,
  emptyMessage,
  onActivate,
}: RoutineListProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">{title}</p>
      {routines.length === 0 ? (
        <p className="font-mono text-sm text-paper-dim">{emptyMessage}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {routines.map((routine) => (
            <RoutineCard
              key={routine.ref}
              routine={routine}
              source={source}
              activities={activities}
              onActivate={onActivate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Replace `RoutineManager.tsx` in full**

Only the prop name/type changes (`exercises` → `activities`) and the pass-through to `RoutineList`/`CreateRoutineForm` follows suit — the rest of the file (active-routine banner, activation, expiry logic) is untouched.

```tsx
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  activateRoutine,
  getActiveRoutine,
  getMyRoutines,
  getRoutineById,
  weeksElapsed,
} from '../../../lib/routines';
import type { RoutineDays } from '../../../lib/weekdays';
import type { ActiveRoutine, Routine } from '../../../types/db';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';
import RoutineList, { type RoutineOption } from './RoutineList';
import CreateRoutineForm from './CreateRoutineForm';

interface PredefinedRoutine {
  id: string;
  name: string;
  goal: string;
  level: string;
  days: RoutineDays;
}

interface Props {
  predefinedRoutines: PredefinedRoutine[];
  activities: ActivityOption[];
}

export default function RoutineManager({ predefinedRoutines, activities }: Props) {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [activeRoutine, setActiveRoutine] = useState<ActiveRoutine | null>(null);
  const [myRoutines, setMyRoutines] = useState<Routine[]>([]);
  const [activeCustomRoutine, setActiveCustomRoutine] = useState<Routine | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [active, mine] = await Promise.all([getActiveRoutine(), getMyRoutines()]);
    setActiveRoutine(active);
    setMyRoutines(mine);
    if (active?.source === 'custom') {
      setActiveCustomRoutine(await getRoutineById(active.routine_ref));
    } else {
      setActiveCustomRoutine(null);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const loggedIn = data.session !== null;
      setIsLoggedIn(loggedIn);
      setAuthChecked(true);
      if (loggedIn) await refresh();
    });
  }, []);

  async function handleActivate(source: 'predefined' | 'custom', ref: string, weeks: number) {
    setError(null);
    if (!Number.isFinite(weeks) || weeks <= 0) {
      setError('La duración debe ser un número de semanas mayor a 0.');
      return;
    }
    try {
      await activateRoutine(source, ref, weeks);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo activar la rutina.');
    }
  }

  if (!authChecked) {
    return <p className="font-mono text-sm text-paper-dim">Cargando...</p>;
  }

  if (!isLoggedIn) {
    return (
      <p className="font-mono text-sm text-paper-dim">
        Debes{' '}
        <a
          href={`${import.meta.env.BASE_URL}login/`}
          className="text-acid underline underline-offset-4 hover:text-paper"
        >
          iniciar sesión
        </a>{' '}
        para ver y armar tus rutinas.
      </p>
    );
  }

  const activeName =
    activeRoutine?.source === 'predefined'
      ? predefinedRoutines.find((p) => p.id === activeRoutine.routine_ref)?.name
      : activeCustomRoutine?.name;

  const elapsed = activeRoutine ? weeksElapsed(activeRoutine.started_at) : 0;
  const expired = activeRoutine ? elapsed >= activeRoutine.duration_weeks : false;

  const predefinedOptions: RoutineOption[] = predefinedRoutines.map((p) => ({
    ref: p.id,
    name: p.name,
    subtitle: `${p.goal} · ${p.level}`,
    days: p.days,
  }));

  const customOptions: RoutineOption[] = myRoutines.map((r) => ({
    ref: r.id,
    name: r.name,
    days: r.days,
  }));

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">Rutina activa</p>
        {!activeRoutine ? (
          <p className="font-mono text-sm text-paper-dim">
            No tenés ninguna rutina activa todavía. Elegí una predefinida o creá la tuya abajo.
          </p>
        ) : expired ? (
          <div className="card-brutal border-blood/60">
            <p className="font-mono text-sm text-blood">
              Tu rutina "{activeName ?? 'desconocida'}" venció hace{' '}
              {elapsed - activeRoutine.duration_weeks + 1} semana(s). ¿Elegís una nueva abajo?
            </p>
          </div>
        ) : (
          <div className="card-brutal">
            <p className="font-display text-2xl text-paper">{activeName ?? 'Rutina desconocida'}</p>
            <p className="font-mono text-sm text-paper-dim">
              Semana {Math.min(elapsed + 1, activeRoutine.duration_weeks)} de{' '}
              {activeRoutine.duration_weeks}
            </p>
          </div>
        )}
      </div>

      {error && <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>}

      <RoutineList
        title="Predefinidas"
        source="predefined"
        routines={predefinedOptions}
        activities={activities}
        emptyMessage="No hay rutinas predefinidas todavía."
        onActivate={handleActivate}
      />

      <RoutineList
        title="Mis rutinas"
        source="custom"
        routines={customOptions}
        activities={activities}
        emptyMessage="Todavía no creaste ninguna rutina propia."
        onActivate={handleActivate}
      />

      <CreateRoutineForm activities={activities} onCreated={refresh} />
    </div>
  );
}
```

- [ ] **Step 4: Update `src/pages/rutinas/index.astro`**

Replace the frontmatter with:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import RoutineManager from '../../components/react/RoutineManager/RoutineManager';
import { getCollection } from 'astro:content';

const planEntries = await getCollection('plans');
const predefinedRoutines = planEntries
  .map((p) => ({
    id: p.id,
    name: p.data.name,
    goal: p.data.goal,
    level: p.data.level,
    days: p.data.days,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const activityEntries = await getCollection('activities');
const activities = activityEntries
  .map((e) => ({
    id: e.id,
    name: e.data.name,
    discipline: e.data.discipline,
    metricType: e.data.metricType,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
---
<BaseLayout title="Rutinas">
  <p class="label-brutal mb-3 text-acid">Elegí o armá tu plan</p>
  <h1 class="mb-8 font-display text-5xl text-paper sm:text-6xl">RUTINAS</h1>
  <RoutineManager client:load predefinedRoutines={predefinedRoutines} activities={activities} />
</BaseLayout>
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: `7 page(s) built`, no errors.

- [ ] **Step 6: Manual smoke check**

```bash
npx astro preview --port 4322
```

Open `/rutinas/`, scroll to "Crear rutina". For "Lunes", use the tabs to add a Gym activity, then switch to the Running tab and add a running activity to the same day — confirm both appear as chips under Lunes (not just the last one added), and that switching tabs alone (without clicking "+ Agregar") doesn't add anything. Remove one chip, confirm it disappears. Save the routine and confirm "Predefinidas"/"Mis rutinas" cards' day summary lists both activities for Lunes.

- [ ] **Step 7: Commit**

```bash
git add src/components/react/RoutineManager/CreateRoutineForm.tsx src/components/react/RoutineManager/RoutineList.tsx src/components/react/RoutineManager/RoutineManager.tsx src/pages/rutinas/index.astro
git commit -m "feat: build mixed-discipline routine days"
```

---

### Task 8: Cardio PR grid and progress chart components

**Files:**
- Create: `src/components/react/ProgressList/CardioPRGrid.tsx`
- Create: `src/components/react/ProgressList/CardioProgressChart.tsx`

- [ ] **Step 1: Write `CardioPRGrid.tsx`**

Mirrors `PRGrid.tsx`, grouping by discipline instead of muscle and showing pace instead of weight.

```tsx
import { DISCIPLINES, type ActivityOption } from '../ActivityPicker/ActivityPicker';
import { formatPace, groupCardioPRsByDiscipline, type CardioPR } from '../../../lib/prs';

interface Props {
  prs: CardioPR[];
  activities: ActivityOption[];
  onSelectActivity: (id: string) => void;
}

export default function CardioPRGrid({ prs, activities, onSelectActivity }: Props) {
  const nameById = new Map(activities.map((a) => [a.id, a.name]));
  const labelByDiscipline = new Map(DISCIPLINES.map((d) => [d.id as string, d.label]));
  const groups = groupCardioPRsByDiscipline(prs, activities);

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      <p className="label-brutal text-acid">Récords de cardio</p>
      {groups.map((group) => (
        <div key={group.discipline} className="flex flex-col gap-3">
          <p className="label-brutal">{labelByDiscipline.get(group.discipline) ?? group.discipline}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.entries.map((pr) => (
              <button
                key={pr.activityId}
                type="button"
                onClick={() => onSelectActivity(pr.activityId)}
                className="card-brutal flex flex-col gap-1 text-left transition-colors hover:border-acid"
              >
                <span className="font-display text-xl text-paper">
                  {nameById.get(pr.activityId) ?? pr.activityId}
                </span>
                <span className="font-mono text-sm text-acid">{formatPace(pr.paceMinPerKm)}</span>
                <span className="font-mono text-xs text-paper-dim">{pr.date}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

`labelByDiscipline` only has entries for `'running'`/`'natacion'` (from `DISCIPLINES`) — the `'Otros'` fallback group falls through to `?? group.discipline`, showing "Otros" literally, same pattern as `muscleLabel`'s own fallback.

- [ ] **Step 2: Write `CardioProgressChart.tsx`**

Mirrors `ProgressChart.tsx` — same Recharts setup, same design tokens, swapping weight for pace (and excluding combate from the activity dropdown, since it never has a pace to chart).

```tsx
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatPace, type CardioProgressPoint } from '../../../lib/prs';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';

interface Props {
  activityId: string;
  points: CardioProgressPoint[];
  activities: ActivityOption[];
  onSelectActivity: (id: string) => void;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="card-brutal font-mono text-sm">
      <p className="text-paper-dim">{label}</p>
      <p className="text-acid">{formatPace(payload[0].value)}</p>
    </div>
  );
}

export default function CardioProgressChart({
  activityId,
  points,
  activities,
  onSelectActivity,
}: Props) {
  const activityName = activities.find((a) => a.id === activityId)?.name ?? activityId;
  const cardioActivities = activities.filter(
    (a) => a.metricType === 'session' && a.discipline !== 'combate'
  );

  return (
    <div className="flex flex-col gap-4">
      <label className="flex max-w-xs flex-col gap-2">
        <span className="label-brutal">Actividad</span>
        <select
          value={activityId}
          onChange={(e) => onSelectActivity(e.target.value)}
          className="input-brutal"
        >
          {cardioActivities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <div className="card-brutal">
        <p className="mb-1 font-display text-2xl text-paper">{activityName}</p>
        <p className="mb-4 font-mono text-xs text-paper-dim">Ritmo — más abajo es más rápido</p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid stroke="#8c8a7c33" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#8c8a7c"
                tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
              />
              <YAxis
                stroke="#8c8a7c"
                tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                tickFormatter={(value: number) => formatPace(value)}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="paceMinPerKm"
                stroke="#d7ff3f"
                strokeWidth={2}
                dot={{ r: 4, fill: '#d7ff3f' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
```

The Y axis is **not** reversed — a lower pace value (faster) sits lower on the chart by default, matching the design spec's "el ritmo mejorando (bajando)" wording exactly: improvement reads as the line going down, same axis convention as every other chart in this app.

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: build completes cleanly. Nothing imports either component yet.

- [ ] **Step 4: Commit**

```bash
git add src/components/react/ProgressList/CardioPRGrid.tsx src/components/react/ProgressList/CardioProgressChart.tsx
git commit -m "feat: add cardio PR grid and progress chart components"
```

---

### Task 9: Wire cardio into the Progreso page

**Files:**
- Modify: `src/components/react/ProgressList/ProgressList.tsx` (full replacement)
- Modify: `src/pages/progreso/index.astro`

- [ ] **Step 1: Replace `ProgressList.tsx` in full**

```tsx
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { getWorkoutsForCurrentUser, getSetsForWorkout, getSessionsForWorkout } from '../../../lib/workouts';
import {
  calculatePRs,
  groupPRsByMuscle,
  progressForExercise,
  calculateCardioPRs,
  groupCardioPRsByDiscipline,
  progressForCardioActivity,
  type WorkoutWithSets,
  type WorkoutWithSessions,
} from '../../../lib/prs';
import type { ActivityOption } from '../ActivityPicker/ActivityPicker';
import PRGrid from './PRGrid';
import ProgressChart from './ProgressChart';
import CardioPRGrid from './CardioPRGrid';
import CardioProgressChart from './CardioProgressChart';

interface ExerciseInfo {
  id: string;
  name: string;
  muscle: string;
}

interface Props {
  exerciseNames: Record<string, string>;
  exercises: ExerciseInfo[];
  activities: ActivityOption[];
}

interface WorkoutWithLogs extends WorkoutWithSets, WorkoutWithSessions {}

export default function ProgressList({ exerciseNames, exercises, activities }: Props) {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutWithLogs[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [selectedCardioActivityId, setSelectedCardioActivityId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const loggedIn = data.session !== null;
      setIsLoggedIn(loggedIn);
      setAuthChecked(true);
      if (!loggedIn) {
        setLoading(false);
        return;
      }
      try {
        const list = await getWorkoutsForCurrentUser();
        const withLogs = await Promise.all(
          list.map(async (w) => ({
            ...w,
            sets: await getSetsForWorkout(w.id),
            sessions: await getSessionsForWorkout(w.id),
          }))
        );
        setWorkouts(withLogs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.');
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const prs = calculatePRs(workouts);
  const muscleGroups = groupPRsByMuscle(prs, exercises);

  const cardioPrs = calculateCardioPRs(workouts);
  const disciplineGroups = groupCardioPRsByDiscipline(cardioPrs, activities);

  const activityNames = new Map(activities.map((a) => [a.id, a.name]));

  useEffect(() => {
    if (selectedExerciseId === null && muscleGroups.length > 0) {
      setSelectedExerciseId(muscleGroups[0].entries[0].exerciseId);
    }
  }, [muscleGroups.length, selectedExerciseId]);

  useEffect(() => {
    if (selectedCardioActivityId === null && disciplineGroups.length > 0) {
      setSelectedCardioActivityId(disciplineGroups[0].entries[0].activityId);
    }
  }, [disciplineGroups.length, selectedCardioActivityId]);

  if (!authChecked || loading) {
    return <p className="font-mono text-sm text-paper-dim">Cargando...</p>;
  }

  if (!isLoggedIn) {
    return (
      <p className="font-mono text-sm text-paper-dim">
        Debes{' '}
        <a
          href={`${import.meta.env.BASE_URL}login/`}
          className="text-acid underline underline-offset-4 hover:text-paper"
        >
          iniciar sesión
        </a>{' '}
        para ver tu historial.
      </p>
    );
  }

  if (error) {
    return <p className="border-l-2 border-blood pl-3 font-mono text-sm text-blood">{error}</p>;
  }

  if (workouts.length === 0) {
    return (
      <p className="font-mono text-sm text-paper-dim">
        Todavía no tienes entrenamientos registrados.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <PRGrid prs={prs} exercises={exercises} onSelectExercise={setSelectedExerciseId} />
      {selectedExerciseId && (
        <ProgressChart
          exerciseId={selectedExerciseId}
          points={progressForExercise(workouts, selectedExerciseId)}
          exercises={exercises}
          onSelectExercise={setSelectedExerciseId}
        />
      )}
      <CardioPRGrid
        prs={cardioPrs}
        activities={activities}
        onSelectActivity={setSelectedCardioActivityId}
      />
      {selectedCardioActivityId && (
        <CardioProgressChart
          activityId={selectedCardioActivityId}
          points={progressForCardioActivity(workouts, selectedCardioActivityId)}
          activities={activities}
          onSelectActivity={setSelectedCardioActivityId}
        />
      )}
      <div className="flex flex-col gap-5">
        {workouts.map((w) => (
          <div key={w.id} className="card-brutal">
            <h2 className="font-display text-2xl tracking-wide text-acid">{w.date}</h2>
            <ul className="mt-3 flex flex-col divide-y divide-paper-dim/20 font-mono text-sm">
              {w.sets.map((s) => (
                <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 py-2">
                  <span className="font-body text-paper">
                    {exerciseNames[s.exercise_id] ?? s.exercise_id}
                  </span>
                  <span className="text-paper-dim">
                    — serie {s.set_number}: {s.reps} reps x {s.weight} kg
                    {s.rpe !== null ? ` (RPE ${s.rpe})` : ''}
                  </span>
                </li>
              ))}
              {w.sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 py-2">
                  <span className="font-body text-paper">
                    {activityNames.get(s.activity_id) ?? s.activity_id}
                  </span>
                  <span className="text-paper-dim">
                    — {s.distance_km !== null ? `${s.distance_km} km en ` : ''}
                    {s.duration_min} min
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Behavior notes:
- `WorkoutWithLogs` structurally satisfies both `WorkoutWithSets` (has `.sets`) and `WorkoutWithSessions` (has `.sessions`), so `calculatePRs(workouts)` and `calculateCardioPRs(workouts)` both accept the same `workouts` array with no cast — the gym functions genuinely never needed to change.
- `PRGrid`/`ProgressChart` (gym) render exactly as before. `CardioPRGrid` returns `null` when there are no cardio PRs yet (e.g. a user who's only logged gym so far), so nothing extra shows up for gym-only users.
- Combate sessions show up only in the per-workout history list at the bottom (via `w.sessions.map`), never in `CardioPRGrid`/`CardioProgressChart` — `calculateCardioPRs` already excludes them (no `distance_km`), so there's nothing to select for them regardless.

- [ ] **Step 2: Update `src/pages/progreso/index.astro`**

Replace the frontmatter with:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import ProgressList from '../../components/react/ProgressList/ProgressList';
import { getCollection } from 'astro:content';
import { isGymActivity } from '../../lib/activities';

const activityEntries = await getCollection('activities');

const gymEntries = activityEntries.filter(isGymActivity);
const exerciseNames = Object.fromEntries(gymEntries.map((e) => [e.id, e.data.name]));
const exercises = gymEntries.map((e) => ({
  id: e.id,
  name: e.data.name,
  muscle: e.data.muscles[0],
}));

const activities = activityEntries
  .map((e) => ({
    id: e.id,
    name: e.data.name,
    discipline: e.data.discipline,
    metricType: e.data.metricType,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
---
<BaseLayout title="Progreso">
  <p class="label-brutal mb-3 text-acid">Tu bitácora</p>
  <h1 class="mb-8 font-display text-5xl text-paper sm:text-6xl">HISTORIAL</h1>
  <ProgressList
    client:load
    exerciseNames={exerciseNames}
    exercises={exercises}
    activities={activities}
  />
</BaseLayout>
```

`exercises`/`exerciseNames` stay gym-only (they only ever look up ids that came from `workout_sets`, which only ever holds gym activity ids). `activities` is the full catalog, used for the cardio grid/chart and for looking up session activity names in the history list.

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: `7 page(s) built`, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/react/ProgressList/ProgressList.tsx src/pages/progreso/index.astro
git commit -m "feat: show cardio PRs and progress chart on the Progreso page"
```

---

### Task 10: End-to-end manual verification

No automated test suite exists in this project — verification is `npm run build` plus a manual Playwright/browser smoke test against the real Supabase project, using a throwaway confirmed test account (same approach used for every prior feature in this project: create a user via the Admin API with `email_confirm: true` using the service role key from `supabase projects api-keys --reveal`; delete the user via the Admin API when done).

**Files:** none (verification only).

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: `7 page(s) built`, no errors — same page count as before this whole plan (no new pages were added).

- [ ] **Step 2: Start a preview server and create a test account**

```bash
npx astro preview --port 4322
```

```bash
SERVICE_KEY=$(supabase projects api-keys --project-ref <ref> --reveal -o json | python3 -c "import json,sys; d=json.load(sys.stdin); print([k['api_key'] for k in d if k.get('name')=='service_role' or k.get('type')=='secret'][0])")
curl -s -X POST "https://<ref>.supabase.co/auth/v1/admin/users" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: application/json" \
  -d '{"email":"multi-disciplina-e2e-<timestamp>@gmail.com","password":"TestPassword123!","email_confirm":true}'
```

- [ ] **Step 3: Build and activate a mixed routine**

Log in as the test user, go to `/rutinas/` → "Crear rutina". On one weekday, add a Gym activity (e.g. Sentadilla) and a Running activity (e.g. "Running — trote libre") using the tabs — confirm both land as separate chips on the same day. Save, then activate the new routine with a short duration (e.g. 4 weeks).

- [ ] **Step 4: Log a mixed workout via "Hoy toca"**

If today's weekday matches the day you built in Step 3, go to `/registro/nuevo/` and confirm "Hoy toca" shows two cards: one with reps/peso/RPE fields for the gym activity, one with distancia/tiempo fields for the running activity. Fill both, confirm they land in the workout via their own "+ Agregar serie"/"+ Agregar sesión" buttons. If today doesn't match, use the free-form "Agregar otra actividad" tabs instead to add one gym set, one running session (with distance), and one combate session (duration only, confirm there's no distance field for it) — save the workout.

- [ ] **Step 5: Log a running progression for the PR/chart check**

Using `/registro/nuevo/`, save 3 separate workouts (different dates) for the **same** running activity with an improving pace — e.g. 5km in 30min, then 5km in 27min, then 5km in 25min.

- [ ] **Step 6: Verify Progreso**

Go to `/progreso/`. Confirm:
- The existing gym "Récords personales" section still works exactly as before (unaffected by this feature).
- A "Récords de cardio" section appears below it, with the running activity's card showing the **fastest** pace (25min/5km ≈ `5:00 /km`) and its date — not the first or the slowest.
- Combate does **not** appear anywhere in "Récords de cardio".
- Clicking the running PR card switches the cardio chart to it; the line has 3 points, and reading left to right the pace value **decreases** (line trends downward) as the sessions got faster — hovering a point shows the correct date and formatted pace (`M:SS /km`) in the tooltip.
- Scrolling to the workout history at the bottom, confirm every logged entry appears — gym sets with reps/peso/RPE as before, running/natación sessions showing distance + time, and the combate session showing only its duration (no "0 km" or similar artifact).

- [ ] **Step 7: Regression-check the Explorador Muscular**

Go to `/ejercicios/`. Confirm the 3D body still renders, hover/click/tooltip and the exercise list still work exactly as before — this page only changed which collection it reads from (Task 1), so this step is purely confirming that change was transparent.

- [ ] **Step 8: "Otros" fallback edge case**

Temporarily delete (or rename) one of the seed running `.md` files whose activity you already logged a session against in Step 5, run `npm run build`, and reload `/progreso/`. Confirm that PR now shows up under an "Otros" group in "Récords de cardio" instead of disappearing. Restore the file afterward and rebuild.

- [ ] **Step 9: Clean up**

Delete the test user via the Admin API (`DELETE /auth/v1/admin/users/<id>`, same headers as Step 2) — cascades delete their workouts/workout_sets/workout_sessions/routines/active_routines automatically per the existing `on delete cascade` foreign keys. Stop the preview server.
