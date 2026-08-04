# SelfGains — Estructura base + Registro de entrenamientos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the SelfGains Astro project and ship a working end-to-end workout logging flow (auth + log a session + view history), deployed to GitHub Pages.

**Architecture:** Astro (`output: 'static'`) with React islands for interactive parts, Tailwind CSS v4 for styling, Supabase (Postgres + Auth) called directly from the browser (no custom backend), and a static exercise library via Astro Content Collections. Deployed via GitHub Actions to GitHub Pages at `https://pamme-ruiz98.github.io/SelfGains/`.

**Tech Stack:** Astro 5, React 19, TypeScript (strict), Tailwind CSS v4, `@supabase/supabase-js`, GitHub Actions + GitHub Pages.

**Testing approach for this cut:** Per the approved design spec (`docs/superpowers/specs/2026-08-04-selfgains-base-y-registro-design.md`), this is simple CRUD UI and doesn't justify an automated test suite yet. Each task is verified with `npm run build` (catches type/config errors) plus a precise manual check. Task 12 is a full manual end-to-end checklist.

**Spec reference:** `docs/superpowers/specs/2026-08-04-selfgains-base-y-registro-design.md`

---

### Task 1: Project scaffold (Astro + TypeScript + React)

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/pages/index.astro` (placeholder root so `astro build` succeeds)

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "selfgains",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "astro": "^5.0.0",
    "@astrojs/react": "^4.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@supabase/supabase-js": "^2.45.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0"
  }
}
```

- [ ] **Step 2: Write `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://pamme-ruiz98.github.io',
  base: '/SelfGains/',
  output: 'static',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules/
dist/
.env
.DS_Store
```

- [ ] **Step 5: Write `.env.example`**

```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 6: Write a placeholder `src/pages/index.astro` so the build has something to compile**

```astro
---
---
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>SelfGains</title>
  </head>
  <body>
    <p>SelfGains</p>
  </body>
</html>
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: installs with no errors, creates `package-lock.json` and `node_modules/`.

- [ ] **Step 8: Verify the build works**

Run: `npm run build`
Expected: `dist/` is generated, no errors.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json .gitignore .env.example src/pages/index.astro
git commit -m "chore: scaffold Astro project with React and TypeScript"
```

---

### Task 2: Tailwind CSS setup

**Files:**
- Create: `src/styles/global.css`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Write `src/styles/global.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 2: Import the stylesheet and add a Tailwind class to `src/pages/index.astro` to verify it's wired up**

```astro
---
import '../styles/global.css';
---
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>SelfGains</title>
  </head>
  <body>
    <p class="text-blue-600 font-bold">SelfGains</p>
  </body>
</html>
```

- [ ] **Step 3: Verify Tailwind is applied**

Run: `npm run build`
Expected: build succeeds. Then run `npm run preview` in the background, fetch the homepage, and confirm the compiled CSS in `dist/` contains a `text-blue-600` rule (e.g. `grep -r "text-blue-600" dist/_astro/*.css`).

- [ ] **Step 4: Commit**

```bash
git add src/styles/global.css src/pages/index.astro
git commit -m "chore: add Tailwind CSS"
```

---

### Task 3: Base layout and navigation

**Files:**
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/components/astro/Nav.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Write `src/components/astro/Nav.astro`**

```astro
---
const base = import.meta.env.BASE_URL;
---
<nav class="bg-gray-900 text-white px-4 py-3 flex gap-4">
  <a href={base}>SelfGains</a>
  <a href={`${base}registro/nuevo/`}>Registrar</a>
  <a href={`${base}progreso/`}>Progreso</a>
  <a href={`${base}login/`}>Login</a>
</nav>
```

- [ ] **Step 2: Write `src/layouts/BaseLayout.astro`**

```astro
---
import '../styles/global.css';
import Nav from '../components/astro/Nav.astro';

interface Props {
  title: string;
}

const { title } = Astro.props;
---
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title} · SelfGains</title>
  </head>
  <body class="min-h-screen bg-gray-50 text-gray-900">
    <Nav />
    <main class="max-w-3xl mx-auto px-4 py-8">
      <slot />
    </main>
  </body>
</html>
```

- [ ] **Step 3: Replace `src/pages/index.astro` with the real homepage**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';

const base = import.meta.env.BASE_URL;
---
<BaseLayout title="Inicio">
  <h1 class="text-3xl font-bold mb-4">SelfGains</h1>
  <p class="mb-6">
    Aprende a entrenar, construye un mejor tú y registra cada entrenamiento en un solo lugar.
  </p>
  <div class="flex gap-4">
    <a href={`${base}registro/nuevo/`} class="bg-blue-600 text-white rounded px-4 py-2">
      Registrar entrenamiento
    </a>
    <a href={`${base}progreso/`} class="border rounded px-4 py-2">
      Ver progreso
    </a>
  </div>
</BaseLayout>
```

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: no errors. Run `npm run dev`, open `http://localhost:4321/SelfGains/`, confirm the nav bar and homepage render with the two links.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/BaseLayout.astro src/components/astro/Nav.astro src/pages/index.astro
git commit -m "feat: add base layout, nav, and homepage"
```

---

### Task 4: Exercise library (Content Collection)

**Files:**
- Create: `src/content.config.ts`
- Create: `src/content/exercises/*.md` (18 files)

- [ ] **Step 1: Write `src/content.config.ts`**

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const exercises = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/exercises' }),
  schema: z.object({
    name: z.string(),
    muscleGroup: z.string(),
    equipment: z.string(),
    videoUrl: z.string().url().optional(),
  }),
});

const plans = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/plans' }),
  schema: z.object({
    name: z.string(),
    goal: z.string(),
    level: z.string(),
  }),
});

export const collections = { exercises, plans };
```

`plans` is defined now (per the design spec) but stays empty in this cut — it's out of scope until the "aprender a entrenar" cut.

- [ ] **Step 2: Create the 18 exercise files**

```bash
mkdir -p src/content/exercises src/content/plans

cat > src/content/exercises/sentadilla.md << 'EOF'
---
name: Sentadilla con barra
muscleGroup: Piernas
equipment: Barra
---

Coloca la barra sobre los trapecios, pies al ancho de hombros. Baja flexionando cadera y rodillas manteniendo la espalda recta, hasta que los muslos queden paralelos al piso. Sube empujando por los talones.
EOF

cat > src/content/exercises/peso-muerto.md << 'EOF'
---
name: Peso muerto
muscleGroup: Piernas y espalda
equipment: Barra
---

Con la barra frente a las espinillas, flexiona cadera y rodillas para tomarla con un agarre firme. Levanta extendiendo cadera y rodillas a la vez, manteniendo la espalda recta y la barra pegada al cuerpo.
EOF

cat > src/content/exercises/press-banca.md << 'EOF'
---
name: Press de banca
muscleGroup: Pecho
equipment: Barra
---

Acostado en el banco, baja la barra de forma controlada hasta rozar el pecho y empuja hacia arriba hasta extender los brazos, sin despegar los glúteos del banco.
EOF

cat > src/content/exercises/press-militar.md << 'EOF'
---
name: Press militar
muscleGroup: Hombros
equipment: Barra
---

De pie, con la barra a la altura de los hombros, empuja hacia arriba hasta extender completamente los brazos, sin arquear excesivamente la espalda baja.
EOF

cat > src/content/exercises/remo-barra.md << 'EOF'
---
name: Remo con barra
muscleGroup: Espalda
equipment: Barra
---

Con el torso inclinado hacia adelante y la espalda recta, jala la barra hacia el abdomen apretando los omóplatos, y baja de forma controlada.
EOF

cat > src/content/exercises/dominadas.md << 'EOF'
---
name: Dominadas
muscleGroup: Espalda
equipment: Barra de dominadas
---

Cuelga de la barra con agarre prono y sube el cuerpo hasta que la barbilla pase la barra, bajando luego de forma controlada hasta extender los brazos.
EOF

cat > src/content/exercises/press-inclinado-mancuernas.md << 'EOF'
---
name: Press inclinado con mancuernas
muscleGroup: Pecho
equipment: Mancuernas
---

En un banco inclinado, empuja las mancuernas hacia arriba desde la altura del pecho hasta extender los brazos, controlando el descenso.
EOF

cat > src/content/exercises/curl-biceps-mancuernas.md << 'EOF'
---
name: Curl de bíceps con mancuernas
muscleGroup: Brazos
equipment: Mancuernas
---

De pie, flexiona los codos llevando las mancuernas hacia los hombros, manteniendo los codos pegados al torso, y baja de forma controlada.
EOF

cat > src/content/exercises/extension-triceps-polea.md << 'EOF'
---
name: Extensión de tríceps en polea
muscleGroup: Brazos
equipment: Polea
---

Con los codos pegados al torso, extiende los antebrazos empujando la cuerda o barra hacia abajo, y regresa de forma controlada.
EOF

cat > src/content/exercises/zancadas.md << 'EOF'
---
name: Zancadas
muscleGroup: Piernas
equipment: Mancuernas
---

Da un paso largo hacia adelante y baja flexionando ambas rodillas hasta casi rozar el suelo con la rodilla trasera, luego regresa a la posición inicial.
EOF

cat > src/content/exercises/elevaciones-laterales.md << 'EOF'
---
name: Elevaciones laterales
muscleGroup: Hombros
equipment: Mancuernas
---

De pie, eleva las mancuernas hacia los lados hasta la altura de los hombros, con los codos ligeramente flexionados, y baja de forma controlada.
EOF

cat > src/content/exercises/face-pull.md << 'EOF'
---
name: Face pull
muscleGroup: Espalda y hombros
equipment: Polea
---

Con la polea a la altura de la cara, jala la cuerda hacia el rostro separando las manos, enfocando el movimiento en la parte posterior del hombro.
EOF

cat > src/content/exercises/hip-thrust.md << 'EOF'
---
name: Hip thrust
muscleGroup: Piernas y glúteos
equipment: Barra
---

Con la espalda apoyada en un banco y la barra sobre la cadera, empuja la cadera hacia arriba apretando los glúteos hasta alinear el torso con los muslos.
EOF

cat > src/content/exercises/plancha-abdominal.md << 'EOF'
---
name: Plancha abdominal
muscleGroup: Core
equipment: Peso corporal
---

Apóyate sobre antebrazos y puntas de los pies, manteniendo el cuerpo en línea recta desde la cabeza hasta los talones, sin dejar caer la cadera.
EOF

cat > src/content/exercises/remo-mancuerna-un-brazo.md << 'EOF'
---
name: Remo con mancuerna a un brazo
muscleGroup: Espalda
equipment: Mancuerna
---

Apoya una rodilla y una mano en un banco, y con la otra mano jala la mancuerna hacia la cadera apretando el omóplato, bajando luego de forma controlada.
EOF

cat > src/content/exercises/press-piernas.md << 'EOF'
---
name: Press de piernas
muscleGroup: Piernas
equipment: Máquina
---

Sentado en la máquina, empuja la plataforma extendiendo las piernas sin bloquear del todo las rodillas, y regresa de forma controlada.
EOF

cat > src/content/exercises/curl-femoral.md << 'EOF'
---
name: Curl femoral
muscleGroup: Piernas
equipment: Máquina
---

Acostado boca abajo en la máquina, flexiona las rodillas llevando el rodillo hacia los glúteos, y regresa de forma controlada.
EOF

cat > src/content/exercises/elevacion-gemelos.md << 'EOF'
---
name: Elevación de gemelos de pie
muscleGroup: Piernas
equipment: Máquina o barra
---

De pie, sube los talones lo más posible apoyando el peso en la punta de los pies, y baja de forma controlada hasta sentir el estiramiento.
EOF
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: no schema validation errors (each file's frontmatter must match the `exercises` schema).

- [ ] **Step 4: Commit**

```bash
git add src/content.config.ts src/content/exercises src/content/plans
git commit -m "feat: add exercise library content collection"
```

---

### Task 5: Supabase schema and client

**Files:**
- Create: `supabase/schema.sql`
- Create: `src/types/db.ts`
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Write `supabase/schema.sql`**

```sql
create table workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  plan_id text,
  notes text,
  created_at timestamptz not null default now()
);

create table workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_id text not null,
  set_number integer not null,
  reps integer not null,
  weight numeric not null,
  rpe numeric,
  created_at timestamptz not null default now()
);

alter table workouts enable row level security;
alter table workout_sets enable row level security;

create policy "Users can manage their own workouts"
  on workouts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage sets of their own workouts"
  on workout_sets for all
  using (
    exists (
      select 1 from workouts
      where workouts.id = workout_sets.workout_id
      and workouts.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from workouts
      where workouts.id = workout_sets.workout_id
      and workouts.user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Write `src/types/db.ts`**

```ts
export interface Workout {
  id: string;
  user_id: string;
  date: string;
  plan_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_number: number;
  reps: number;
  weight: number;
  rpe: number | null;
  created_at: string;
}
```

- [ ] **Step 3: Write `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 4: Manual step (requires a human with a Supabase account) — create the Supabase project**

1. Go to https://supabase.com, create a free project (any name/region).
2. In the SQL Editor, paste and run the contents of `supabase/schema.sql`.
3. Go to Project Settings → API, copy the "Project URL" and the "anon public" key.
4. Create a local `.env` file (already gitignored) with:
   ```
   PUBLIC_SUPABASE_URL=<project-url>
   PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   ```

- [ ] **Step 5: Verify**

Run: `npm run build`
Expected: no errors (the build doesn't need real Supabase credentials to succeed, since calls happen client-side at runtime).

- [ ] **Step 6: Commit**

```bash
git add supabase/schema.sql src/types/db.ts src/lib/supabase.ts
git commit -m "feat: add Supabase schema, client, and DB types"
```

(`.env` is gitignored and never committed.)

---

### Task 6: Workouts data access library

**Files:**
- Create: `src/lib/workouts.ts`

- [ ] **Step 1: Write `src/lib/workouts.ts`**

```ts
import { supabase } from './supabase';
import type { Workout, WorkoutSet } from '../types/db';

export async function createWorkout(date: string, notes?: string): Promise<Workout> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('workouts')
    .insert({ user_id: user.id, date, notes: notes ?? null })
    .select()
    .single();

  if (error) throw error;
  return data as Workout;
}

export async function addSet(
  workoutId: string,
  exerciseId: string,
  setNumber: number,
  reps: number,
  weight: number,
  rpe?: number
): Promise<WorkoutSet> {
  const { data, error } = await supabase
    .from('workout_sets')
    .insert({
      workout_id: workoutId,
      exercise_id: exerciseId,
      set_number: setNumber,
      reps,
      weight,
      rpe: rpe ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as WorkoutSet;
}

export async function getWorkoutsForCurrentUser(): Promise<Workout[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .order('date', { ascending: false });

  if (error) throw error;
  return data as Workout[];
}

export async function getSetsForWorkout(workoutId: string): Promise<WorkoutSet[]> {
  const { data, error } = await supabase
    .from('workout_sets')
    .select('*')
    .eq('workout_id', workoutId)
    .order('set_number', { ascending: true });

  if (error) throw error;
  return data as WorkoutSet[];
}
```

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/workouts.ts
git commit -m "feat: add workouts data access functions"
```

---

### Task 7: Authentication (login + signup)

**Files:**
- Create: `src/components/react/Auth/LoginForm.tsx`
- Create: `src/components/react/Auth/SignupForm.tsx`
- Create: `src/pages/login.astro`
- Create: `src/pages/registro-cuenta.astro`

- [ ] **Step 1: Write `src/components/react/Auth/LoginForm.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    window.location.href = `${import.meta.env.BASE_URL}registro/nuevo/`;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <label className="flex flex-col gap-1">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span>Contraseña</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="border rounded px-3 py-2"
        />
      </label>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Write `src/components/react/Auth/SignupForm.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';

export default function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <p>
        Cuenta creada. Revisa tu correo para confirmar la cuenta y luego{' '}
        <a href={`${import.meta.env.BASE_URL}login/`} className="text-blue-600 underline">
          inicia sesión
        </a>
        .
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <label className="flex flex-col gap-1">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span>Contraseña</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="border rounded px-3 py-2"
        />
      </label>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {loading ? 'Creando cuenta...' : 'Crear cuenta'}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Write `src/pages/login.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import LoginForm from '../components/react/Auth/LoginForm';

const base = import.meta.env.BASE_URL;
---
<BaseLayout title="Iniciar sesión">
  <h1 class="text-2xl font-bold mb-4">Iniciar sesión</h1>
  <LoginForm client:load />
  <p class="mt-4 text-sm">
    ¿No tienes cuenta? <a href={`${base}registro-cuenta/`} class="text-blue-600 underline">Crea una</a>
  </p>
</BaseLayout>
```

- [ ] **Step 4: Write `src/pages/registro-cuenta.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import SignupForm from '../components/react/Auth/SignupForm';
---
<BaseLayout title="Crear cuenta">
  <h1 class="text-2xl font-bold mb-4">Crear cuenta</h1>
  <SignupForm client:load />
</BaseLayout>
```

- [ ] **Step 5: Verify**

Run: `npm run build`
Expected: no errors. Run `npm run dev`, open `/SelfGains/registro-cuenta/`, create an account with a real email you control, confirm it via the email Supabase sends, then log in at `/SelfGains/login/` and confirm you're redirected to `/SelfGains/registro/nuevo/` (that page doesn't exist yet — a 404 here is expected until Task 8; the redirect happening is what you're checking).

- [ ] **Step 6: Commit**

```bash
git add src/components/react/Auth src/pages/login.astro src/pages/registro-cuenta.astro
git commit -m "feat: add login and signup"
```

---

### Task 8: Workout logger

**Files:**
- Create: `src/components/react/WorkoutLogger/WorkoutLogger.tsx`
- Create: `src/pages/registro/nuevo.astro`

- [ ] **Step 1: Write `src/components/react/WorkoutLogger/WorkoutLogger.tsx`**

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import { createWorkout, addSet } from '../../../lib/workouts';

interface ExerciseOption {
  id: string;
  name: string;
  muscleGroup: string;
}

interface LoggedSet {
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  reps: number;
  weight: number;
  rpe: number | null;
}

interface Props {
  exercises: ExerciseOption[];
}

export default function WorkoutLogger({ exercises }: Props) {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loggedSets, setLoggedSets] = useState<LoggedSet[]>([]);

  const [exerciseId, setExerciseId] = useState(exercises[0]?.id ?? '');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [rpe, setRpe] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(data.session !== null);
      setAuthChecked(true);
    });
  }, []);

  function handleAddSet(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const repsNum = Number(reps);
    const weightNum = Number(weight);
    const rpeNum = rpe === '' ? null : Number(rpe);

    if (!exerciseId) {
      setError('Elige un ejercicio.');
      return;
    }
    if (!Number.isFinite(repsNum) || repsNum <= 0) {
      setError('Las repeticiones deben ser un número mayor a 0.');
      return;
    }
    if (!Number.isFinite(weightNum) || weightNum < 0) {
      setError('El peso debe ser un número válido.');
      return;
    }
    if (rpeNum !== null && (!Number.isFinite(rpeNum) || rpeNum < 0 || rpeNum > 10)) {
      setError('El RPE debe ser un número entre 0 y 10.');
      return;
    }

    const exercise = exercises.find((ex) => ex.id === exerciseId);
    const setNumber = loggedSets.filter((s) => s.exerciseId === exerciseId).length + 1;

    setLoggedSets((prev) => [
      ...prev,
      {
        exerciseId,
        exerciseName: exercise?.name ?? exerciseId,
        setNumber,
        reps: repsNum,
        weight: weightNum,
        rpe: rpeNum,
      },
    ]);
    setReps('');
    setWeight('');
    setRpe('');
  }

  function handleRemoveSet(index: number) {
    setLoggedSets((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveWorkout() {
    if (loggedSets.length === 0) {
      setError('Agrega al menos una serie antes de guardar.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const workout = await createWorkout(date);
      for (const s of loggedSets) {
        await addSet(workout.id, s.exerciseId, s.setNumber, s.reps, s.weight, s.rpe ?? undefined);
      }
      setSavedMessage('Entrenamiento guardado correctamente.');
      setLoggedSets([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el entrenamiento.');
    } finally {
      setSaving(false);
    }
  }

  if (!authChecked) {
    return <p>Cargando...</p>;
  }

  if (!isLoggedIn) {
    return (
      <p>
        Debes{' '}
        <a href={`${import.meta.env.BASE_URL}login/`} className="text-blue-600 underline">
          iniciar sesión
        </a>{' '}
        para registrar un entrenamiento.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <label className="flex flex-col gap-1">
        <span>Fecha</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>

      <form onSubmit={handleAddSet} className="flex flex-col gap-3 border rounded p-4">
        <label className="flex flex-col gap-1">
          <span>Ejercicio</span>
          <select
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
            className="border rounded px-3 py-2"
          >
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name} ({ex.muscleGroup})
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-3">
          <label className="flex flex-col gap-1 flex-1">
            <span>Reps</span>
            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              min={1}
              required
              className="border rounded px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 flex-1">
            <span>Peso (kg)</span>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              min={0}
              step="0.5"
              required
              className="border rounded px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 flex-1">
            <span>RPE (opcional)</span>
            <input
              type="number"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              min={0}
              max={10}
              step="0.5"
              className="border rounded px-3 py-2"
            />
          </label>
        </div>
        <button type="submit" className="bg-gray-800 text-white rounded px-4 py-2 self-start">
          Agregar serie
        </button>
      </form>

      {loggedSets.length > 0 && (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="border-b py-1">Ejercicio</th>
              <th className="border-b py-1">Serie</th>
              <th className="border-b py-1">Reps</th>
              <th className="border-b py-1">Peso</th>
              <th className="border-b py-1">RPE</th>
              <th className="border-b py-1"></th>
            </tr>
          </thead>
          <tbody>
            {loggedSets.map((s, i) => (
              <tr key={i}>
                <td className="py-1">{s.exerciseName}</td>
                <td className="py-1">{s.setNumber}</td>
                <td className="py-1">{s.reps}</td>
                <td className="py-1">{s.weight}</td>
                <td className="py-1">{s.rpe ?? '-'}</td>
                <td className="py-1">
                  <button
                    type="button"
                    onClick={() => handleRemoveSet(i)}
                    className="text-red-600 text-sm"
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {savedMessage && <p className="text-green-600 text-sm">{savedMessage}</p>}

      <button
        type="button"
        onClick={handleSaveWorkout}
        disabled={saving}
        className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50 self-start"
      >
        {saving ? 'Guardando...' : 'Guardar entrenamiento'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/pages/registro/nuevo.astro`**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import WorkoutLogger from '../../components/react/WorkoutLogger/WorkoutLogger';
import { getCollection } from 'astro:content';

const exerciseEntries = await getCollection('exercises');
const exercises = exerciseEntries
  .map((e) => ({ id: e.id, name: e.data.name, muscleGroup: e.data.muscleGroup }))
  .sort((a, b) => a.name.localeCompare(b.name));
---
<BaseLayout title="Registrar entrenamiento">
  <h1 class="text-2xl font-bold mb-4">Registrar entrenamiento</h1>
  <WorkoutLogger client:load exercises={exercises} />
</BaseLayout>
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: no errors. Run `npm run dev`, log in, open `/SelfGains/registro/nuevo/`, add 2-3 sets for different exercises (table should show them), then click "Guardar entrenamiento" and confirm the success message appears and the table clears. In the Supabase dashboard (Table Editor), confirm rows were created in `workouts` and `workout_sets`.

- [ ] **Step 4: Commit**

```bash
git add src/components/react/WorkoutLogger src/pages/registro
git commit -m "feat: add workout logger"
```

---

### Task 9: Progress history

**Files:**
- Create: `src/components/react/ProgressList/ProgressList.tsx`
- Create: `src/pages/progreso/index.astro`

- [ ] **Step 1: Write `src/components/react/ProgressList/ProgressList.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { getWorkoutsForCurrentUser, getSetsForWorkout } from '../../../lib/workouts';
import type { Workout, WorkoutSet } from '../../../types/db';

interface WorkoutWithSets extends Workout {
  sets: WorkoutSet[];
}

export default function ProgressList() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutWithSets[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const withSets = await Promise.all(
          list.map(async (w) => ({ ...w, sets: await getSetsForWorkout(w.id) }))
        );
        setWorkouts(withSets);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.');
      } finally {
        setLoading(false);
      }
    });
  }, []);

  if (!authChecked || loading) return <p>Cargando...</p>;

  if (!isLoggedIn) {
    return (
      <p>
        Debes{' '}
        <a href={`${import.meta.env.BASE_URL}login/`} className="text-blue-600 underline">
          iniciar sesión
        </a>{' '}
        para ver tu historial.
      </p>
    );
  }

  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  if (workouts.length === 0) {
    return <p>Todavía no tienes entrenamientos registrados.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {workouts.map((w) => (
        <div key={w.id} className="border rounded p-4">
          <h2 className="font-bold">{w.date}</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {w.sets.map((s) => (
              <li key={s.id}>
                {s.exercise_id} — serie {s.set_number}: {s.reps} reps x {s.weight} kg
                {s.rpe !== null ? ` (RPE ${s.rpe})` : ''}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write `src/pages/progreso/index.astro`**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import ProgressList from '../../components/react/ProgressList/ProgressList';
---
<BaseLayout title="Progreso">
  <h1 class="text-2xl font-bold mb-4">Tu historial</h1>
  <ProgressList client:load />
</BaseLayout>
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: no errors. Run `npm run dev`, open `/SelfGains/progreso/` while logged in, confirm the workout you saved in Task 8 appears with its sets listed. Log out (via Supabase dashboard or clearing local storage) and reload — confirm the "debes iniciar sesión" message appears instead.

- [ ] **Step 4: Commit**

```bash
git add src/components/react/ProgressList src/pages/progreso
git commit -m "feat: add progress history page"
```

---

### Task 10: Deploy pipeline to GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
        env:
          PUBLIC_SUPABASE_URL: ${{ vars.PUBLIC_SUPABASE_URL }}
          PUBLIC_SUPABASE_ANON_KEY: ${{ vars.PUBLIC_SUPABASE_ANON_KEY }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Manual step (requires a human with push/admin access to the GitHub repo)**

1. Push this repo to `https://github.com/pamme-ruiz98/SelfGains` (create it on GitHub first if it doesn't exist yet).
2. In the repo, go to Settings → Pages → Source, select "GitHub Actions".
3. Go to Settings → Secrets and variables → Actions → Variables tab, add repository variables `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` with the same values as your local `.env` (the anon key is safe to expose publicly — it's protected by the RLS policies from Task 5).
4. Push to `main` and confirm the "Deploy to GitHub Pages" workflow run succeeds in the Actions tab, and the site loads at `https://pamme-ruiz98.github.io/SelfGains/`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "chore: add GitHub Pages deploy workflow"
```

---

### Task 11: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# SelfGains

App de fitness que combina tres pilares:

1. **Aprender a entrenar** — guías y planes predefinidos para principiantes.
2. **Construir un mejor yo** — progreso general, hábitos, motivación.
3. **Registro de entrenamientos** — series, reps, peso, progresión, PRs.

Este repo está en construcción por cortes incrementales. El primero cubre la
estructura base del proyecto y el registro de entrenamientos (series, reps,
peso, RPE) con historial simple.

## Stack

- [Astro](https://astro.build) (`output: 'static'`) como framework principal
- [React](https://react.dev) para las islas interactivas (formularios, gráficas)
- TypeScript en todo el proyecto
- [Tailwind CSS](https://tailwindcss.com) para estilos
- [Supabase](https://supabase.com) (Postgres + Auth), llamado directo desde el
  navegador — no hay backend propio
- Biblioteca de ejercicios y planes predefinidos como Astro Content
  Collections (Markdown versionado en el repo)
- Desplegado en GitHub Pages vía GitHub Actions

## Correr localmente

1. Clona el repo e instala dependencias:

   ```bash
   git clone https://github.com/pamme-ruiz98/SelfGains.git
   cd SelfGains
   npm install
   ```

2. Crea un proyecto en [Supabase](https://supabase.com), corre
   `supabase/schema.sql` en el SQL Editor del proyecto, y copia la URL y la
   anon key desde Project Settings → API.

3. Copia `.env.example` a `.env` y completa los valores:

   ```
   PUBLIC_SUPABASE_URL=<tu-project-url>
   PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
   ```

4. Levanta el servidor de desarrollo:

   ```bash
   npm run dev
   ```

   Abre `http://localhost:4321/SelfGains/`.

## Deploy

Cada push a `main` corre `.github/workflows/deploy.yml`, que construye el
sitio y lo publica en GitHub Pages
(`https://pamme-ruiz98.github.io/SelfGains/`). El workflow necesita las
variables de repositorio `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY`
configuradas en Settings → Secrets and variables → Actions → Variables.

## Estado del proyecto

- [x] Estructura base + registro de entrenamientos (auth, log de series,
      historial simple)
- [ ] Planes predefinidos y biblioteca de ejercicios completa
- [ ] Sugerencia de progresión automática
- [ ] Gráficas de progreso y cálculo de PRs
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with project vision and setup instructions"
```

---

### Task 12: End-to-end manual verification checklist

No new files — this is the manual QA pass for the whole cut, run against the local dev server (`npm run dev`) with a real Supabase project configured.

- [ ] **Step 1: Signup flow** — go to `/SelfGains/registro-cuenta/`, create an account with an email you control, confirm the "revisa tu correo" message appears, confirm the account via the email link.
- [ ] **Step 2: Login flow** — go to `/SelfGains/login/`, log in with the account from Step 1, confirm redirect to `/SelfGains/registro/nuevo/`.
- [ ] **Step 3: Log a workout** — on `/SelfGains/registro/nuevo/`, add 3 sets across 2 different exercises, confirm they appear in the table with correct set numbers per exercise, click "Guardar entrenamiento", confirm the success message and that the table clears.
- [ ] **Step 4: Error handling** — try adding a set with reps `0` or empty weight, confirm an inline error appears and no set is added; confirm previously entered values in other fields aren't lost.
- [ ] **Step 5: View history** — go to `/SelfGains/progreso/`, confirm the workout from Step 3 appears with the correct date and all its sets.
- [ ] **Step 6: Logged-out gating** — open an incognito window, visit `/SelfGains/registro/nuevo/` and `/SelfGains/progreso/` directly, confirm both show a "debes iniciar sesión" message instead of the forms.
- [ ] **Step 7: Production deploy** — after Task 10's manual GitHub setup, repeat Steps 1-5 against `https://pamme-ruiz98.github.io/SelfGains/` to confirm the deployed site works end to end.
