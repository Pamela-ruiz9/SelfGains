# Perfil enriquecido (nivel de entrenamiento + sexo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El usuario puede declarar su nivel de entrenamiento y sexo en Perfil (ambos opcionales), y eso hace que las rutinas predefinidas de gym que coinciden se marquen "Recomendada para vos" y aparezcan primero en `/rutinas/` — sin ocultar ni bloquear el resto.

**Architecture:** Dos columnas nuevas y nullable en `profiles` (mismo patrón que `theme`: texto + `check`). El campo `sex` se suma como opcional al schema de contenido `plans`; se agregan 4 rutinas de gym nuevas (variantes por sexo de las 2 que ya existen, que quedan intactas como opción unisex). Toda la lógica de recomendación vive en el cliente (`RoutineManager.tsx`), comparando el perfil ya cargado contra la lista de rutinas predefinidas que la página ya recibía — sin queries nuevas a Supabase ni cambios de ruta.

**Nota sobre el estilo de este plan:** el proyecto no tiene suite de tests automatizada (confirmado en `docs/agents/*-status.md` de features anteriores) — la verificación es build + `tsc --noEmit` + Playwright contra Supabase real, mismo patrón que todos los planes previos de este repo (ver `docs/superpowers/plans/2026-08-18-rol-entrenador.md`).

**Tech Stack:** Astro 5 + React (`client:load`), Supabase (Postgres + RLS), Zod (validación de contenido) — sin dependencias nuevas.

**Reference:** Diseño completo en `docs/superpowers/specs/2026-08-19-perfil-enriquecido-nivel-sexo-design.md`.

---

## File Structure

- **Modify:** `supabase/schema.sql` — columnas `profiles.sex` y `profiles.training_level`.
- **Modify:** `src/types/db.ts` — `Profile.sex`, `Profile.training_level`.
- **Modify:** `src/lib/profile.ts` — comentario de seguridad (sin cambio funcional): estos campos nunca se mirror-ean a `public_identities`.
- **Modify:** `src/content.config.ts` — colección `plans` gana `sex` opcional.
- **Create:** `src/content/plans/full-body-gluteo-pierna.md`, `full-body-empuje-espalda.md`, `push-pull-legs-gluteo-pierna.md`, `push-pull-legs-empuje-espalda.md`.
- **Modify:** `src/components/react/Profile/ProfileForm.tsx` — selectores de Sexo y Nivel de entrenamiento.
- **Modify:** `src/pages/rutinas/index.astro` — pasar `sex` de cada plan predefinido.
- **Modify:** `src/components/react/RoutineManager/RoutineManager.tsx` — cálculo de recomendación + orden.
- **Modify:** `src/components/react/RoutineManager/RoutineList.tsx` — etiqueta "Recomendada para vos".

---

### Task 1: Migración de base de datos + tipos TypeScript

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `src/types/db.ts`
- Modify: `src/lib/profile.ts`

- [ ] **Step 1: Agregar la migración al final de `supabase/schema.sql`**

```sql

-- Perfil enriquecido: nivel de entrenamiento y sexo
-- (docs/superpowers/specs/2026-08-19-perfil-enriquecido-nivel-sexo-design.md).
-- Ambas nullable, sin default — un perfil sin completar queda simplemente
-- sin recomendación de rutina por esa señal, nunca bloquea nada.
alter table profiles add column sex text check (sex in ('femenino', 'masculino'));
alter table profiles add column training_level text check (training_level in ('principiante', 'intermedio', 'avanzado'));
```

- [ ] **Step 2: Aplicar la migración contra el proyecto real**

Escribir el bloque SQL de arriba a un archivo (para esquivar el clasificador de auto-mode con secretos, aunque acá no hay ninguno, es el patrón ya establecido) y correrlo:

```bash
supabase db query --linked --file <archivo.sql>
```

Si el clasificador de permisos bloquea el comando igual, pedirle al usuario que lo corra con el prefijo `!` (patrón ya usado en sesiones anteriores de este proyecto).

- [ ] **Step 3: Verificar que las columnas existen**

```bash
supabase db query --linked "select column_name, data_type from information_schema.columns where table_name = 'profiles' and column_name in ('sex', 'training_level');"
```

Expected: dos filas, ambas `data_type = text`.

- [ ] **Step 4: Actualizar `src/types/db.ts`**

Reemplazar:

```ts
export interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  arm_cm: number | null;
  leg_cm: number | null;
  accent_color: string;
  theme: 'light' | 'dark';
  is_trainer: boolean;
  updated_at: string;
}
```

por:

```ts
export interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  arm_cm: number | null;
  leg_cm: number | null;
  accent_color: string;
  theme: 'light' | 'dark';
  is_trainer: boolean;
  sex: 'femenino' | 'masculino' | null;
  training_level: 'principiante' | 'intermedio' | 'avanzado' | null;
  updated_at: string;
}
```

- [ ] **Step 5: Agregar un comentario de seguridad en `src/lib/profile.ts`**

En `upsertProfile`, justo antes del `upsert` a `public_identities` (que hoy solo copia `display_name`/`avatar_url`/`is_trainer`), agregar el comentario:

```ts
  // sex/training_level NO se agregan acá a propósito: son datos privados
  // de perfil que ninguna conexión (ni un entrenador conectado) puede leer
  // — ver docs/superpowers/specs/2026-08-19-perfil-enriquecido-nivel-sexo-design.md
  // y la nota de seguridad de docs/agents/rol-entrenador-status.md sobre
  // por qué `public_identities` existe separada de `profiles`.
  const { error: identityError } = await supabase.from('public_identities').upsert({
```

(Reemplaza la línea `const { error: identityError } = await supabase.from('public_identities').upsert({` existente, agregando el comentario justo arriba — el resto del bloque no cambia.)

- [ ] **Step 6: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio. `tsc` limpio salvo el error preexistente y no relacionado de `ProgressList.tsx`.

- [ ] **Step 7: Commit**

```bash
git add supabase/schema.sql src/types/db.ts src/lib/profile.ts
git commit -m "feat: add sex and training_level columns to profiles"
```

---

### Task 2: Schema de rutinas (`sex`) + 4 rutinas nuevas de gym

**Files:**
- Modify: `src/content.config.ts`
- Create: `src/content/plans/full-body-gluteo-pierna.md`
- Create: `src/content/plans/full-body-empuje-espalda.md`
- Create: `src/content/plans/push-pull-legs-gluteo-pierna.md`
- Create: `src/content/plans/push-pull-legs-empuje-espalda.md`

**Contexto:** `full-body.md` y `push-pull-legs.md` quedan sin tocar — siguen siendo la opción unisex de cada nivel. Todos los ids de actividad usados abajo ya existen en `src/content/activities/` (verificado contra el catálogo real antes de escribir este plan).

- [ ] **Step 1: Agregar `sex` opcional al schema de `plans`**

En `src/content.config.ts`, dentro de `const plans = defineCollection({ ... schema: z.object({ ... }) })`, reemplazar:

```ts
  schema: z.object({
    name: z.string(),
    goal: z.string(),
    level: z.string(),
    days: z.object({
```

por:

```ts
  schema: z.object({
    name: z.string(),
    goal: z.string(),
    level: z.string(),
    // Solo relevante para gym — running/natación/combate lo dejan sin
    // definir. Ver docs/superpowers/specs/2026-08-19-perfil-enriquecido-nivel-sexo-design.md.
    sex: z.enum(['femenino', 'masculino']).optional(),
    days: z.object({
```

- [ ] **Step 2: Crear `src/content/plans/full-body-gluteo-pierna.md`**

```md
---
name: Full body — Glúteo y pierna
goal: Fuerza general
level: Principiante
sex: femenino
days:
  lunes: [sentadilla-goblet, hip-thrust, remo-barra]
  miercoles: [peso-muerto-rumano, abductor-maquina, press-banca]
  viernes: [zancadas, puente-gluteo, jalon-al-pecho]
---

Variante de Full body con más volumen de glúteo y tren inferior en cada sesión, combinado con un ejercicio de empuje o jalón. Martes, jueves, sábado y domingo son descanso.
```

- [ ] **Step 3: Crear `src/content/plans/full-body-empuje-espalda.md`**

```md
---
name: Full body — Empuje y espalda
goal: Fuerza general
level: Principiante
sex: masculino
days:
  lunes: [press-banca, remo-barra, sentadilla]
  miercoles: [press-militar, jalon-al-pecho, prensa-piernas-45]
  viernes: [press-inclinado-mancuernas, remo-polea-baja-sentado, zancadas]
---

Variante de Full body con más volumen de empuje y espalda en cada sesión, combinado con un ejercicio de pierna. Martes, jueves, sábado y domingo son descanso.
```

- [ ] **Step 4: Crear `src/content/plans/push-pull-legs-gluteo-pierna.md`**

```md
---
name: Push/Pull/Legs — Glúteo y pierna
goal: Hipertrofia
level: Intermedio
sex: femenino
days:
  lunes: [press-banca, press-militar]
  martes: [remo-barra, dominadas]
  jueves: [sentadilla-bulgara, hip-thrust, prensa-piernas-unilateral, curl-femoral]
  viernes: [abductor-maquina, puente-gluteo, patada-gluteo-polea]
---

Variante de Push/Pull/Legs con push y pull recortados, un día de pierna expandido con énfasis en glúteo, y un cuarto día de accesorio de glúteo (en vez del accesorio de hombro del original). Miércoles, sábado y domingo son descanso.
```

- [ ] **Step 5: Crear `src/content/plans/push-pull-legs-empuje-espalda.md`**

```md
---
name: Push/Pull/Legs — Empuje y espalda
goal: Hipertrofia
level: Intermedio
sex: masculino
days:
  lunes: [press-banca, press-militar, press-inclinado-mancuernas, extension-triceps-polea]
  martes: [remo-barra, dominadas, jalon-al-pecho, curl-biceps-mancuernas]
  jueves: [sentadilla, curl-femoral]
  viernes: [elevaciones-laterales, pajaros-mancuernas, encogimientos-hombros]
---

Variante de Push/Pull/Legs con push y pull expandidos y el día de pierna recortado. El cuarto día de accesorio de hombro y espalda queda igual que en el original. Miércoles, sábado y domingo son descanso.
```

- [ ] **Step 6: Verificar que el build valida el contenido nuevo**

Run: `npm run build`
Expected: build limpio. Si algún id de actividad estuviera mal escrito, Zod tira un error de validación de contenido señalando el archivo — si eso pasa, revisar el slug exacto en `src/content/activities/`.

- [ ] **Step 7: Commit**

```bash
git add src/content.config.ts src/content/plans/full-body-gluteo-pierna.md src/content/plans/full-body-empuje-espalda.md src/content/plans/push-pull-legs-gluteo-pierna.md src/content/plans/push-pull-legs-empuje-espalda.md
git commit -m "content: add sex-specific gym routine variants"
```

---

### Task 3: Perfil — selectores de Sexo y Nivel de entrenamiento

**Files:**
- Modify: `src/components/react/Profile/ProfileForm.tsx`

**Contexto:** Mismo patrón visual y de guardado inmediato que el selector de tema (Oscuro/Claro) y de unidad de peso (Kilos/Libras) que ya existen en este archivo — un grupo de botones, sin submit explícito. Se agrega una tercera opción "Sin especificar" en cada grupo para poder volver a `null` (a diferencia de tema/unidad, acá "sin definir" es un estado legítimo, no solo el estado inicial).

- [ ] **Step 1: Agregar el estado**

En el bloque de `useState` cerca del inicio del componente, después de `const [weightUnit, setWeightUnitState] = useState<WeightUnit>(() => getWeightUnit());`, agregar:

```tsx
  const [sex, setSex] = useState<'femenino' | 'masculino' | null>(null);
  const [trainingLevel, setTrainingLevel] = useState<
    'principiante' | 'intermedio' | 'avanzado' | null
  >(null);
```

- [ ] **Step 2: Cargar los valores del perfil**

En el `useEffect` de carga inicial, dentro del bloque `if (profile) { ... }`, justo después de `setIsTrainer(profile.is_trainer);`, agregar:

```tsx
        setSex(profile.sex);
        setTrainingLevel(profile.training_level);
```

- [ ] **Step 3: Agregar los handlers**

Después de la función `handleWeightUnitChange`, agregar:

```tsx
  async function handleSexChange(next: 'femenino' | 'masculino' | null) {
    setSex(next);
    try {
      await upsertProfile({ sex: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el sexo.');
    }
  }

  async function handleTrainingLevelChange(next: 'principiante' | 'intermedio' | 'avanzado' | null) {
    setTrainingLevel(next);
    try {
      await upsertProfile({ training_level: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el nivel.');
    }
  }
```

- [ ] **Step 4: Agregar la UI**

Reemplazar:

```tsx
        <p className="font-mono text-xs text-paper-dim">
          Se aplica al peso que registras en tus series de gym. Se guarda en este dispositivo.
        </p>
      </div>

      {routineExpired && (
```

por:

```tsx
        <p className="font-mono text-xs text-paper-dim">
          Se aplica al peso que registras en tus series de gym. Se guarda en este dispositivo.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">Sexo</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleSexChange('femenino')}
            className={sex === 'femenino' ? 'btn-brutal-sm border-acid bg-acid text-on-accent' : 'btn-brutal-sm'}
          >
            Femenino
          </button>
          <button
            type="button"
            onClick={() => handleSexChange('masculino')}
            className={sex === 'masculino' ? 'btn-brutal-sm border-acid bg-acid text-on-accent' : 'btn-brutal-sm'}
          >
            Masculino
          </button>
          <button
            type="button"
            onClick={() => handleSexChange(null)}
            className={sex === null ? 'btn-brutal-sm border-acid bg-acid text-on-accent' : 'btn-brutal-sm'}
          >
            Sin especificar
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="label-brutal text-acid">Nivel de entrenamiento</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleTrainingLevelChange('principiante')}
            className={
              trainingLevel === 'principiante' ? 'btn-brutal-sm border-acid bg-acid text-on-accent' : 'btn-brutal-sm'
            }
          >
            Principiante
          </button>
          <button
            type="button"
            onClick={() => handleTrainingLevelChange('intermedio')}
            className={
              trainingLevel === 'intermedio' ? 'btn-brutal-sm border-acid bg-acid text-on-accent' : 'btn-brutal-sm'
            }
          >
            Intermedio
          </button>
          <button
            type="button"
            onClick={() => handleTrainingLevelChange('avanzado')}
            className={
              trainingLevel === 'avanzado' ? 'btn-brutal-sm border-acid bg-acid text-on-accent' : 'btn-brutal-sm'
            }
          >
            Avanzado
          </button>
          <button
            type="button"
            onClick={() => handleTrainingLevelChange(null)}
            className={
              trainingLevel === null ? 'btn-brutal-sm border-acid bg-acid text-on-accent' : 'btn-brutal-sm'
            }
          >
            Sin especificar
          </button>
        </div>
        <p className="font-mono text-xs text-paper-dim">
          Se usa para recomendarte rutinas predefinidas de gym en Rutinas.
        </p>
      </div>

      {routineExpired && (
```

- [ ] **Step 5: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio, mismo error preexistente esperado en `ProgressList.tsx` y ninguno más.

- [ ] **Step 6: Commit**

```bash
git add src/components/react/Profile/ProfileForm.tsx
git commit -m "feat: add sex and training level selectors to Perfil"
```

---

### Task 4: Recomendación de rutinas de gym en `/rutinas/`

**Files:**
- Modify: `src/pages/rutinas/index.astro`
- Modify: `src/components/react/RoutineManager/RoutineManager.tsx`
- Modify: `src/components/react/RoutineManager/RoutineList.tsx`

- [ ] **Step 1: Pasar `sex` de cada plan predefinido**

En `src/pages/rutinas/index.astro`, en el `.map()` que arma `predefinedRoutines`, reemplazar:

```ts
const predefinedRoutines = planEntries
  .map((p) => ({
    id: p.id,
    name: p.data.name,
    goal: p.data.goal,
    level: p.data.level,
    days: p.data.days,
  }))
```

por:

```ts
const predefinedRoutines = planEntries
  .map((p) => ({
    id: p.id,
    name: p.data.name,
    goal: p.data.goal,
    level: p.data.level,
    sex: p.data.sex,
    days: p.data.days,
  }))
```

- [ ] **Step 2: Agregar `recommended` a `RoutineOption`**

En `src/components/react/RoutineManager/RoutineList.tsx`, reemplazar:

```ts
export interface RoutineOption {
  ref: string;
  name: string;
  subtitle?: string;
  days: RoutineDays;
  assignedByName?: string | null;
}
```

por:

```ts
export interface RoutineOption {
  ref: string;
  name: string;
  subtitle?: string;
  days: RoutineDays;
  assignedByName?: string | null;
  recommended?: boolean;
}
```

- [ ] **Step 3: Renderizar la etiqueta "Recomendada para vos"**

En el mismo archivo, dentro de `RoutineCard`, reemplazar:

```tsx
          {routine.subtitle && <p className="label-brutal">{routine.subtitle}</p>}
          {routine.assignedByName && (
```

por:

```tsx
          {routine.subtitle && <p className="label-brutal">{routine.subtitle}</p>}
          {routine.recommended && <p className="label-brutal text-acid">Recomendada para vos</p>}
          {routine.assignedByName && (
```

- [ ] **Step 4: Ampliar los imports de `RoutineManager.tsx`**

Reemplazar:

```ts
import { getWorkoutsForCurrentUser } from '../../../lib/workouts';
import { weekAdherence } from '../../../lib/adherence';
import type { RoutineDays } from '../../../lib/weekdays';
```

por:

```ts
import { getWorkoutsForCurrentUser } from '../../../lib/workouts';
import { weekAdherence } from '../../../lib/adherence';
import { entryActivityId, WEEKDAYS, type RoutineDays } from '../../../lib/weekdays';
import { getMyProfile } from '../../../lib/profile';
```

- [ ] **Step 5: Agregar `sex` a `PredefinedRoutine` y el estado de perfil**

Reemplazar:

```ts
interface PredefinedRoutine {
  id: string;
  name: string;
  goal: string;
  level: string;
  days: RoutineDays;
}
```

por:

```ts
interface PredefinedRoutine {
  id: string;
  name: string;
  goal: string;
  level: string;
  sex?: 'femenino' | 'masculino';
  days: RoutineDays;
}
```

Y, en el cuerpo del componente, después de `const [error, setError] = useState<string | null>(null);`, agregar:

```ts
  const [profileSex, setProfileSex] = useState<'femenino' | 'masculino' | null>(null);
  const [profileLevel, setProfileLevel] = useState<
    'principiante' | 'intermedio' | 'avanzado' | null
  >(null);
```

- [ ] **Step 6: Cargar el perfil en `refresh()`**

Reemplazar:

```ts
  async function refresh() {
    const [active, mine, workouts] = await Promise.all([
      getActiveRoutine(),
      getMyRoutines(),
      getWorkoutsForCurrentUser(),
    ]);
    setActiveRoutine(active);
    setMyRoutines(mine);
    setWorkoutDates(new Set(workouts.map((w) => w.date)));
    if (active?.source === 'custom') {
```

por:

```ts
  async function refresh() {
    const [active, mine, workouts, profile] = await Promise.all([
      getActiveRoutine(),
      getMyRoutines(),
      getWorkoutsForCurrentUser(),
      getMyProfile(),
    ]);
    setActiveRoutine(active);
    setMyRoutines(mine);
    setWorkoutDates(new Set(workouts.map((w) => w.date)));
    setProfileSex(profile?.sex ?? null);
    setProfileLevel(profile?.training_level ?? null);
    if (active?.source === 'custom') {
```

- [ ] **Step 7: Agregar las funciones de recomendación**

Antes de `interface PredefinedRoutine`, agregar:

```ts
// Una rutina de gym solo puede recomendarse si al menos un día referencia
// una actividad de disciplina 'gym' — running/natación/combate no tienen
// `sex` en su contenido y quedan fuera de este cálculo por completo.
function isGymPlan(days: RoutineDays, activities: ActivityOption[]): boolean {
  for (const day of WEEKDAYS) {
    for (const entry of days[day]) {
      const activity = activities.find((a) => a.id === entryActivityId(entry));
      if (activity) return activity.discipline === 'gym';
    }
  }
  return false;
}

// Un campo que el usuario sí completó y que contradice al plan lo descarta,
// sin importar qué diga el otro campo. Pero para que se recomiende hace
// falta que al menos un campo coincida activamente — un perfil vacío (o
// donde no se completó nada) nunca debe hacer que todo se vea "recomendado".
function isRecommendedGymPlan(
  plan: { level: string; sex?: 'femenino' | 'masculino' },
  profileSex: 'femenino' | 'masculino' | null,
  profileLevel: 'principiante' | 'intermedio' | 'avanzado' | null
): boolean {
  const planLevel = plan.level.toLowerCase();

  if (profileLevel !== null && planLevel !== profileLevel) return false;
  if (profileSex !== null && plan.sex !== undefined && plan.sex !== profileSex) return false;

  const levelAgrees = profileLevel !== null && planLevel === profileLevel;
  const sexAgrees = profileSex !== null && plan.sex !== undefined && plan.sex === profileSex;
  return levelAgrees || sexAgrees;
}
```

- [ ] **Step 8: Usar las funciones al construir `predefinedOptions`**

Reemplazar:

```ts
  const predefinedOptions: RoutineOption[] = predefinedRoutines.map((p) => ({
    ref: p.id,
    name: p.name,
    subtitle: `${p.goal} · ${p.level}`,
    days: p.days,
  }));
```

por:

```ts
  const predefinedOptions: RoutineOption[] = predefinedRoutines
    .map((p) => ({
      ref: p.id,
      name: p.name,
      subtitle: `${p.goal} · ${p.level}`,
      days: p.days,
      recommended:
        isGymPlan(p.days, activities) && isRecommendedGymPlan(p, profileSex, profileLevel),
    }))
    // Sort es estable — dentro de "recomendadas" y "resto" se conserva el
    // orden alfabético que ya trae `predefinedRoutines` desde la página.
    .sort((a, b) => Number(b.recommended) - Number(a.recommended));
```

- [ ] **Step 9: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio, mismo error preexistente esperado en `ProgressList.tsx` y ninguno más.

- [ ] **Step 10: Commit**

```bash
git add src/pages/rutinas/index.astro src/components/react/RoutineManager/RoutineManager.tsx src/components/react/RoutineManager/RoutineList.tsx
git commit -m "feat: recommend gym routines by declared level and sex"
```

---

### Task 5: Verificación manual end-to-end

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Confirmar que el build completo sigue limpio**

Run: `npm run build && npx tsc --noEmit`
Expected: igual que en los tasks anteriores.

- [ ] **Step 2: Preparar la cuenta de prueba**

Mismo patrón que sesiones anteriores (ver `docs/agents/notas-de-entorno-y-lecciones.md`): escribir a un archivo y correr

```sql
UPDATE auth.users SET encrypted_password = crypt('<nueva-clave>', gen_salt('bf')) WHERE email = 'crud-e2e-1786826288@gmail.com';
```

vía `supabase db query --linked --file <archivo.sql>`. Si el clasificador de auto-mode lo bloquea, pedirle al usuario que lo corra con `!`.

- [ ] **Step 3: Playwright — completar y persistir sexo/nivel**

Con `npx astro preview` corriendo (build ya hecho en Step 1): loguear con la cuenta de prueba, ir a `/perfil/`, click en "Femenino" y en "Principiante", recargar la página, confirmar que ambos botones siguen resaltados (persistieron). Click en "Sin especificar" en ambos grupos, recargar, confirmar que vuelven a su estado sin resaltar.

- [ ] **Step 4: Playwright — recomendación con perfil vacío**

Con sexo/nivel en "Sin especificar" (desde el Step anterior), ir a `/rutinas/` → "Agregar nueva rutina" → "Elegir predefinida". Confirmar que **ninguna** rutina de gym muestra "Recomendada para vos" — ni las 2 originales ni las 4 nuevas.

- [ ] **Step 5: Playwright — recomendación con sexo + nivel declarados**

En `/perfil/`, click en "Femenino" y en "Principiante". Volver a `/rutinas/` → "Elegir predefinida". Confirmar:
- "Full body" (unisex) y "Full body — Glúteo y pierna" muestran "Recomendada para vos" y aparecen antes que el resto en la grilla.
- "Full body — Empuje y espalda" **no** muestra la etiqueta (sexo no coincide).
- Ninguna rutina de Push/Pull/Legs muestra la etiqueta (nivel no coincide).
- Las rutinas de running/natación/combate no muestran la etiqueta y no cambiaron de posición.
- Todas las rutinas, recomendadas o no, siguen teniendo su botón "Activar" funcional (activar una no recomendada, confirmar que queda activa, desactivarla de nuevo).

- [ ] **Step 6: Restaurar el estado de la cuenta de prueba**

Volver a poner en "Sin especificar" sexo y nivel en `/perfil/` (o dejarlos como estaban antes del Step 3, si se registró ese estado). Si se activó alguna rutina distinta a la que tenía la cuenta antes de esta verificación, reactivar la original — mismo cuidado que en sesiones anteriores de dejar la cuenta de prueba reusable en su estado previo.

- [ ] **Step 7: Actualizar la documentación de la sesión**

- Actualizar `docs/roadmap-ideas.md`: sacar "Perfil enriquecido" de "Ideas de producto abiertas" (ya no queda ninguna idea de producto abierta en el backlog).
- Crear `docs/agents/perfil-enriquecido-status.md` con el resumen de lo implementado, siguiendo el formato de los demás `docs/agents/*-status.md`.

```bash
git add docs/roadmap-ideas.md docs/agents/perfil-enriquecido-status.md
git commit -m "docs: log perfil enriquecido (nivel + sexo) and close the last open backlog item"
```
