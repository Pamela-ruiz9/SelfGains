# SelfGains — Explorador muscular 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/ejercicios/` page with a rotatable low-poly 3D body where clicking a muscle lists the exercises (from the existing library) that work it.

**Architecture:** A React Three Fiber scene (`MuscleBody`) renders ~24 primitive-geometry meshes, one or two per muscle in a 14-muscle taxonomy, plus a few non-interactive filler meshes for silhouette. Clicking/hovering a mesh drives selection state in a parent component (`MuscleExplorer`), which filters the exercise library (now tagged with a `muscles: string[]` field instead of the old single `muscleGroup` string) and renders an expandable list. Everything is static-site-compatible — no server, all client-side.

**Tech Stack:** `three`, `@react-three/fiber`, `@react-three/drei` (added to the existing Astro 5 + React 19 + TypeScript + Tailwind v4 + Supabase stack from cut 1).

**Testing approach:** Same as cut 1 — no automated suite, manual verification. Additional known constraint: there is no working headless browser in the development environment used to build this, so the 3D scene cannot be screenshotted or visually self-verified during implementation — Task 7 is a manual checklist for a human to run in a real browser.

**Spec reference:** `docs/superpowers/specs/2026-08-04-selfgains-explorador-muscular-3d-design.md`

---

### Task 1: Muscle taxonomy

**Files:**
- Create: `src/lib/muscles.ts`

- [ ] **Step 1: Write `src/lib/muscles.ts`**

```ts
export interface Muscle {
  id: string;
  label: string;
}

export const MUSCLES: Muscle[] = [
  { id: 'pecho', label: 'Pecho' },
  { id: 'dorsales', label: 'Dorsales' },
  { id: 'trapecio', label: 'Trapecio' },
  { id: 'deltoide-frontal', label: 'Deltoide frontal' },
  { id: 'deltoide-lateral', label: 'Deltoide lateral' },
  { id: 'deltoide-posterior', label: 'Deltoide posterior' },
  { id: 'biceps', label: 'Bíceps' },
  { id: 'triceps', label: 'Tríceps' },
  { id: 'antebrazo', label: 'Antebrazo' },
  { id: 'abdomen', label: 'Abdomen' },
  { id: 'cuadriceps', label: 'Cuádriceps' },
  { id: 'isquiotibiales', label: 'Isquiotibiales' },
  { id: 'gluteos', label: 'Glúteos' },
  { id: 'gemelos', label: 'Gemelos' },
];

export function muscleLabel(id: string): string {
  return MUSCLES.find((m) => m.id === id)?.label ?? id;
}
```

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: no errors (this file isn't imported anywhere yet, but must type-check on its own).

- [ ] **Step 3: Commit**

```bash
git add src/lib/muscles.ts
git commit -m "feat: add muscle taxonomy"
```

---

### Task 2: Exercises schema change + retag all 18 exercises

**Files:**
- Modify: `src/content.config.ts`
- Modify: all 18 files in `src/content/exercises/`

- [ ] **Step 1: Update the `exercises` schema in `src/content.config.ts`**

Change the `exercises` collection's schema field from `muscleGroup: z.string()` to `muscles: z.array(z.string())`. The full collection definition should read:

```ts
const exercises = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/exercises' }),
  schema: z.object({
    name: z.string(),
    muscles: z.array(z.string()),
    equipment: z.string(),
    videoUrl: z.string().url().optional(),
  }),
});
```

(Leave the `plans` collection and the rest of the file untouched.)

- [ ] **Step 2: Retag all 18 exercise files' frontmatter**

Each exercise's `muscleGroup: ...` line is replaced with a `muscles: [...]` line, using the muscle ids from Task 1's taxonomy. An exercise can list multiple muscles. Run:

```bash
sed -i "s/^muscleGroup: .*/muscles: [cuadriceps, gluteos]/" src/content/exercises/sentadilla.md
sed -i "s/^muscleGroup: .*/muscles: [isquiotibiales, gluteos, dorsales]/" src/content/exercises/peso-muerto.md
sed -i "s/^muscleGroup: .*/muscles: [pecho, triceps]/" src/content/exercises/press-banca.md
sed -i "s/^muscleGroup: .*/muscles: [deltoide-frontal, triceps]/" src/content/exercises/press-militar.md
sed -i "s/^muscleGroup: .*/muscles: [dorsales, trapecio, biceps]/" src/content/exercises/remo-barra.md
sed -i "s/^muscleGroup: .*/muscles: [dorsales, biceps, antebrazo]/" src/content/exercises/dominadas.md
sed -i "s/^muscleGroup: .*/muscles: [pecho, deltoide-frontal, triceps]/" src/content/exercises/press-inclinado-mancuernas.md
sed -i "s/^muscleGroup: .*/muscles: [biceps, antebrazo]/" src/content/exercises/curl-biceps-mancuernas.md
sed -i "s/^muscleGroup: .*/muscles: [triceps]/" src/content/exercises/extension-triceps-polea.md
sed -i "s/^muscleGroup: .*/muscles: [cuadriceps, gluteos]/" src/content/exercises/zancadas.md
sed -i "s/^muscleGroup: .*/muscles: [deltoide-lateral]/" src/content/exercises/elevaciones-laterales.md
sed -i "s/^muscleGroup: .*/muscles: [deltoide-posterior, trapecio]/" src/content/exercises/face-pull.md
sed -i "s/^muscleGroup: .*/muscles: [gluteos, isquiotibiales]/" src/content/exercises/hip-thrust.md
sed -i "s/^muscleGroup: .*/muscles: [abdomen]/" src/content/exercises/plancha-abdominal.md
sed -i "s/^muscleGroup: .*/muscles: [dorsales, biceps]/" src/content/exercises/remo-mancuerna-un-brazo.md
sed -i "s/^muscleGroup: .*/muscles: [cuadriceps, gluteos]/" src/content/exercises/press-piernas.md
sed -i "s/^muscleGroup: .*/muscles: [isquiotibiales]/" src/content/exercises/curl-femoral.md
sed -i "s/^muscleGroup: .*/muscles: [gemelos]/" src/content/exercises/elevacion-gemelos.md
```

- [ ] **Step 3: Verify every file was actually changed and no `muscleGroup:` lines remain**

Run: `grep -rl "muscleGroup:" src/content/exercises/`
Expected: no output (empty — if any file is listed, its `sed` command above didn't match and needs to be re-run/fixed).

Run: `grep -c "^muscles: \[" src/content/exercises/*.md | grep -v ":1"`
Expected: no output (every file should have exactly one `muscles: [...]` line).

- [ ] **Step 4: Verify all 14 muscles from Task 1 appear at least once across the retagged files**

Run this check (fails loudly if any muscle id from `src/lib/muscles.ts` is missing from every exercise file — this would mean a later muscle-detail page has no exercises to show):

```bash
for m in pecho dorsales trapecio deltoide-frontal deltoide-lateral deltoide-posterior biceps triceps antebrazo abdomen cuadriceps isquiotibiales gluteos gemelos; do
  count=$(grep -l "muscles:.*\b$m\b" src/content/exercises/*.md | wc -l)
  echo "$m: $count exercise(s)"
  if [ "$count" -eq 0 ]; then
    echo "MISSING: no exercise tags $m"
    exit 1
  fi
done
```

Expected: all 14 muscles print a count of 1 or more, no "MISSING" line, exit code 0.

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: no schema validation errors (every file's `muscles` array must be valid per the new zod schema — an array of strings).

- [ ] **Step 6: Commit**

```bash
git add src/content.config.ts src/content/exercises
git commit -m "feat: retag exercises with specific muscles instead of muscle group"
```

---

### Task 3: Add 3D rendering dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add dependencies**

Add these three lines to the `"dependencies"` object in `package.json` (alongside the existing `astro`, `@astrojs/react`, `react`, `react-dom`, `@supabase/supabase-js` entries):

```json
    "three": "^0.170.0",
    "@react-three/fiber": "^9.0.0",
    "@react-three/drei": "^9.0.0"
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: installs with no errors. If npm reports peer dependency conflicts involving React 19 (e.g. `@react-three/fiber` or `@react-three/drei` expecting a different major React version), STOP and report it — don't force-install with `--legacy-peer-deps` or downgrade React without checking with the coordinator first.

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: still succeeds (nothing imports the new packages yet, this just confirms install didn't break anything).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add three.js and react-three-fiber dependencies"
```

---

### Task 4: 3D body scene (`MuscleBody`)

**Files:**
- Create: `src/components/react/MuscleBody/MuscleBody.tsx`

- [ ] **Step 1: Write `src/components/react/MuscleBody/MuscleBody.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Edges } from '@react-three/drei';

interface MuscleBodyProps {
  selectedMuscle: string | null;
  onSelectMuscle: (id: string) => void;
}

type PartGeometry =
  | { type: 'box'; args: [number, number, number] }
  | { type: 'sphere'; args: [number] }
  | { type: 'capsule'; args: [number, number] };

interface MusclePartDef {
  muscleId: string;
  position: [number, number, number];
  geometry: PartGeometry;
}

interface StaticPartDef {
  position: [number, number, number];
  geometry: PartGeometry;
}

const STATIC_PARTS: StaticPartDef[] = [
  { position: [0, 1.55, 0], geometry: { type: 'sphere', args: [0.22] } },
  { position: [0, 0.85, 0], geometry: { type: 'box', args: [0.34, 0.75, 0.22] } },
  { position: [0, 0.15, 0], geometry: { type: 'box', args: [0.4, 0.28, 0.24] } },
  { position: [0.2, -1.05, 0.08], geometry: { type: 'box', args: [0.14, 0.08, 0.28] } },
  { position: [-0.2, -1.05, 0.08], geometry: { type: 'box', args: [0.14, 0.08, 0.28] } },
];

function mirror(
  muscleId: string,
  x: number,
  y: number,
  z: number,
  geometry: PartGeometry
): MusclePartDef[] {
  return [
    { muscleId, position: [x, y, z], geometry },
    { muscleId, position: [-x, y, z], geometry },
  ];
}

const MUSCLE_PARTS: MusclePartDef[] = [
  { muscleId: 'pecho', position: [0, 0.98, 0.18], geometry: { type: 'box', args: [0.46, 0.32, 0.14] } },
  { muscleId: 'dorsales', position: [0, 0.82, -0.18], geometry: { type: 'box', args: [0.46, 0.4, 0.14] } },
  { muscleId: 'trapecio', position: [0, 1.2, -0.14], geometry: { type: 'box', args: [0.34, 0.16, 0.16] } },
  { muscleId: 'abdomen', position: [0, 0.55, 0.16], geometry: { type: 'box', args: [0.36, 0.3, 0.12] } },
  ...mirror('deltoide-frontal', 0.58, 1.15, 0.14, { type: 'sphere', args: [0.12] }),
  ...mirror('deltoide-lateral', 0.68, 1.15, 0, { type: 'sphere', args: [0.12] }),
  ...mirror('deltoide-posterior', 0.58, 1.15, -0.14, { type: 'sphere', args: [0.12] }),
  ...mirror('biceps', 0.64, 0.82, 0.1, { type: 'capsule', args: [0.09, 0.32] }),
  ...mirror('triceps', 0.64, 0.82, -0.1, { type: 'capsule', args: [0.09, 0.32] }),
  ...mirror('antebrazo', 0.64, 0.42, 0, { type: 'capsule', args: [0.075, 0.36] }),
  ...mirror('cuadriceps', 0.22, -0.05, 0.12, { type: 'capsule', args: [0.14, 0.5] }),
  ...mirror('isquiotibiales', 0.22, -0.05, -0.12, { type: 'capsule', args: [0.13, 0.5] }),
  ...mirror('gluteos', 0.2, 0.18, -0.16, { type: 'sphere', args: [0.16] }),
  ...mirror('gemelos', 0.22, -0.62, -0.02, { type: 'capsule', args: [0.11, 0.42] }),
];

const COLOR_STATIC = '#201e16';
const COLOR_MUSCLE = '#33311f';
const COLOR_ACTIVE = '#d7ff3f';
const COLOR_EDGE = '#f4f1e4';

function PartMesh({ geometry }: { geometry: PartGeometry }) {
  if (geometry.type === 'box') return <boxGeometry args={geometry.args} />;
  if (geometry.type === 'sphere') return <sphereGeometry args={[geometry.args[0], 12, 12]} />;
  return <capsuleGeometry args={[geometry.args[0], geometry.args[1], 4, 8]} />;
}

function StaticMesh({ part }: { part: StaticPartDef }) {
  return (
    <mesh position={part.position}>
      <PartMesh geometry={part.geometry} />
      <meshStandardMaterial color={COLOR_STATIC} flatShading />
      <Edges color={COLOR_EDGE} />
    </mesh>
  );
}

function MuscleMesh({
  part,
  active,
  onHover,
  onUnhover,
  onClick,
}: {
  part: MusclePartDef;
  active: boolean;
  onHover: () => void;
  onUnhover: () => void;
  onClick: () => void;
}) {
  return (
    <mesh
      position={part.position}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover();
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onUnhover();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <PartMesh geometry={part.geometry} />
      <meshStandardMaterial color={active ? COLOR_ACTIVE : COLOR_MUSCLE} flatShading />
      <Edges color={COLOR_EDGE} />
    </mesh>
  );
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

export default function MuscleBody({ selectedMuscle, onSelectMuscle }: MuscleBodyProps) {
  const [hoveredMuscle, setHoveredMuscle] = useState<string | null>(null);
  const webglAvailable = useMemo(() => hasWebGL(), []);

  if (!webglAvailable) {
    return (
      <div className="card-brutal flex h-[420px] items-center justify-center text-center">
        <p className="font-mono text-sm text-paper-dim">
          Tu navegador no soporta WebGL, así que no se puede mostrar el cuerpo 3D. Puedes
          seguir usando el resto de SelfGains con normalidad.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[420px] border-2 border-paper-dim/30 sm:h-[520px]">
      <Canvas camera={{ position: [0, 0.4, 4], fov: 40 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 4]} intensity={1} />
        <directionalLight position={[-3, 2, -4]} intensity={0.4} />
        {STATIC_PARTS.map((part, i) => (
          <StaticMesh key={i} part={part} />
        ))}
        {MUSCLE_PARTS.map((part, i) => (
          <MuscleMesh
            key={i}
            part={part}
            active={part.muscleId === selectedMuscle || part.muscleId === hoveredMuscle}
            onHover={() => setHoveredMuscle(part.muscleId)}
            onUnhover={() => setHoveredMuscle((prev) => (prev === part.muscleId ? null : prev))}
            onClick={() => onSelectMuscle(part.muscleId)}
          />
        ))}
        <OrbitControls enablePan={false} minDistance={2.5} maxDistance={6} target={[0, 0.4, 0]} />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: no TypeScript/build errors. (This component isn't imported by any page yet, so this only validates it type-checks and bundles in isolation via Astro's project-wide type checking — full integration is verified in Task 6.)

- [ ] **Step 3: Commit**

```bash
git add src/components/react/MuscleBody
git commit -m "feat: add 3D muscle body scene"
```

---

### Task 5: Muscle explorer container (`MuscleExplorer`)

**Files:**
- Create: `src/components/react/MuscleExplorer/MuscleExplorer.tsx`

- [ ] **Step 1: Write `src/components/react/MuscleExplorer/MuscleExplorer.tsx`**

```tsx
import { useState } from 'react';
import MuscleBody from '../MuscleBody/MuscleBody';
import { muscleLabel } from '../../../lib/muscles';

export interface ExerciseWithMuscles {
  id: string;
  name: string;
  equipment: string;
  instructions: string;
  muscles: string[];
}

interface Props {
  exercises: ExerciseWithMuscles[];
}

export default function MuscleExplorer({ exercises }: Props) {
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);

  function handleSelectMuscle(id: string) {
    setSelectedMuscle((prev) => (prev === id ? null : id));
    setExpandedExercise(null);
  }

  const matchingExercises = selectedMuscle
    ? exercises.filter((ex) => ex.muscles.includes(selectedMuscle))
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <MuscleBody selectedMuscle={selectedMuscle} onSelectMuscle={handleSelectMuscle} />

      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">
          {selectedMuscle ? muscleLabel(selectedMuscle) : 'Ningún músculo seleccionado'}
        </p>

        {!selectedMuscle && (
          <p className="font-mono text-sm text-paper-dim">
            Haz click en un músculo del modelo para ver qué ejercicios lo trabajan. Puedes
            rotar el modelo arrastrando con el mouse o el dedo.
          </p>
        )}

        {selectedMuscle && matchingExercises.length === 0 && (
          <p className="font-mono text-sm text-paper-dim">
            Todavía no hay ejercicios registrados para este músculo.
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {matchingExercises.map((ex) => {
            const isExpanded = expandedExercise === ex.id;
            return (
              <li key={ex.id} className="card-brutal">
                <button
                  type="button"
                  onClick={() => setExpandedExercise(isExpanded ? null : ex.id)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <span className="font-display text-lg tracking-wide text-paper">{ex.name}</span>
                  <span className="font-mono text-xs text-acid">{isExpanded ? '−' : '+'}</span>
                </button>
                {isExpanded && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-paper-dim/20 pt-3 font-mono text-sm text-paper-dim">
                    <p>
                      <span className="text-paper-dim/70">Equipo: </span>
                      {ex.equipment}
                    </p>
                    <p>{ex.instructions}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/react/MuscleExplorer
git commit -m "feat: add muscle explorer container with exercise list"
```

---

### Task 6: Page, nav link, and workout-logger label fix

**Files:**
- Create: `src/pages/ejercicios/index.astro`
- Modify: `src/components/astro/Nav.astro`
- Modify: `src/pages/registro/nuevo.astro`

- [ ] **Step 1: Write `src/pages/ejercicios/index.astro`**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import MuscleExplorer from '../../components/react/MuscleExplorer/MuscleExplorer';
import { getCollection } from 'astro:content';

const exerciseEntries = await getCollection('exercises');
const exercises = exerciseEntries
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

- [ ] **Step 2: Add the "Ejercicios" link to `src/components/astro/Nav.astro`**

Find the `links` array (currently `registro/nuevo/`, `progreso/`, `login/`) and add an `ejercicios/` entry as the first item, so the order is Ejercicios → Registrar → Progreso → Login:

```ts
const links = [
  { href: `${base}ejercicios/`, label: "Ejercicios" },
  { href: `${base}registro/nuevo/`, label: "Registrar" },
  { href: `${base}progreso/`, label: "Progreso" },
  { href: `${base}login/`, label: "Login" },
];
```

Leave the rest of `Nav.astro` (the `isActive` function, the JSX) untouched — it already maps over `links` generically.

- [ ] **Step 3: Update `src/pages/registro/nuevo.astro` to compute the muscle-group label from the new `muscles` array**

Replace the file's frontmatter script section so it imports `muscleLabel` and builds a joined label string per exercise, instead of reading a `muscleGroup` field that no longer exists on the content collection:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import WorkoutLogger from '../../components/react/WorkoutLogger/WorkoutLogger';
import { getCollection } from 'astro:content';
import { muscleLabel } from '../../lib/muscles';

const exerciseEntries = await getCollection('exercises');
const exercises = exerciseEntries
  .map((e) => ({
    id: e.id,
    name: e.data.name,
    muscleGroup: e.data.muscles.map((m) => muscleLabel(m)).join(', '),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
---
<BaseLayout title="Registrar entrenamiento">
  <p class="label-brutal mb-3 text-acid">Sesión de hoy</p>
  <h1 class="mb-8 font-display text-5xl text-paper sm:text-6xl">REGISTRAR ENTRENAMIENTO</h1>
  <WorkoutLogger client:load exercises={exercises} />
</BaseLayout>
```

`WorkoutLogger.tsx` itself is unchanged — it still receives an `ExerciseOption[]` with `{ id, name, muscleGroup }`, just computed differently upstream.

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: no errors, 6 pages generated (the 5 from cut 1 plus `/ejercicios/`).

Run: `npm run dev`, open `/SelfGains/ejercicios/`, confirm the page loads and the nav shows "Ejercicios" as the first link, active-highlighted on that page. Open `/SelfGains/registro/nuevo/` (logged in) and confirm the exercise dropdown still shows sensible text like "Sentadilla con barra (Cuádriceps, Glúteos)" instead of "undefined" or blank.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ejercicios src/components/astro/Nav.astro src/pages/registro/nuevo.astro
git commit -m "feat: add ejercicios page, nav link, and fix workout logger muscle label"
```

---

### Task 7: Manual verification checklist

No new files — manual QA pass against `npm run dev`, run by a human in a real browser (this implementation could not be visually self-verified — there is no working headless browser in the environment it was built in).

- [ ] **Step 1: Page loads** — go to `/SelfGains/ejercicios/`, confirm the 3D canvas renders a body-like shape (not a blank box or an error) and the right-hand panel shows "Ningún músculo seleccionado" with the instructional text.
- [ ] **Step 2: Rotation** — click-drag (or touch-drag on mobile) inside the canvas, confirm the body rotates smoothly and you can see the back side (dorsales, trapecio, glúteos, isquiotibiales, gemelos should be visible from behind).
- [ ] **Step 3: Hover feedback** — move the mouse over a few different muscle meshes without clicking, confirm each highlights (turns acid-green) on hover and returns to its dim color on mouse-out.
- [ ] **Step 4: Click selection** — click "Pecho" (front chest box), confirm the right panel updates to show "Pecho" as the heading and lists exercises tagged with pecho (should include "Press de banca" and "Press inclinado con mancuernas"). Click the same muscle again, confirm it deselects back to the placeholder state.
- [ ] **Step 5: Expand exercise detail** — with a muscle selected, click one of the listed exercises, confirm it expands to show "Equipo: ..." and the instructions paragraph, matching what's in that exercise's `.md` file. Click again to collapse.
- [ ] **Step 6: Coverage spot-check** — select at least 3 different muscles (e.g. one from each limb/torso area — try "Antebrazo" and "Trapecio" specifically since those only got exercises via secondary tagging) and confirm each shows at least one exercise, not the "todavía no hay ejercicios" empty state.
- [ ] **Step 7: WorkoutLogger regression check** — go to `/SelfGains/registro/nuevo/`, confirm the exercise dropdown shows real muscle names (not blank/undefined) next to each exercise name.
- [ ] **Step 8: WebGL fallback (optional, only if easy to test)** — if you have a way to disable WebGL in your browser (e.g. a flag or extension), confirm `/ejercicios/` shows the fallback message instead of a broken canvas.
