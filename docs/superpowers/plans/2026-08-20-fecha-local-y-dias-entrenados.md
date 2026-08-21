# Fecha local (CDMX) y días entrenados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La app deja de mostrar la fecha adelantada un día por la noche (bug de conversión a UTC), y "Esta semana: X de Y días cumplidos" en Rutinas pasa a contar cualquier día que el usuario entrenó, sin filtrar por si la rutina activa programaba algo ese día.

**Architecture:** Un helper de fecha local compartido (`localDateStr`, exportado desde `src/lib/weekdays.ts`) reemplaza tres usos de `new Date().toISOString().slice(0, 10)` (que convierte a UTC antes de cortar la fecha) y la copia privada equivalente que ya existía en `src/lib/adherence.ts`. `weekAdherence()` deja de recibir `routineDays` y cuenta directamente los días con un entrenamiento logueado entre el lunes y hoy.

**Tech Stack:** TypeScript/React (ya en el stack) — sin dependencias nuevas, sin cambio de schema.

**Reference:** Diseño completo en `docs/superpowers/specs/2026-08-20-fecha-local-y-dias-entrenados-design.md`.

---

## File Structure

- **Modify:** `src/lib/weekdays.ts` — nuevo export `localDateStr`.
- **Modify:** `src/components/react/WorkoutLogger/WorkoutLogger.tsx` — usa `localDateStr` en vez del cálculo con `toISOString()`.
- **Modify:** `src/lib/routines.ts` — usa `localDateStr` al activar una rutina.
- **Modify:** `src/lib/adherence.ts` — usa `localDateStr` compartido; `weekAdherence` cuenta cualquier día entrenado, no solo los programados por la rutina.
- **Modify:** `src/components/react/RoutineManager/RoutineManager.tsx` — adapta la llamada a `weekAdherence` y los nombres de campo en el JSX.

---

### Task 1: Fecha local compartida (corrige el bug de UTC)

**Files:**
- Modify: `src/lib/weekdays.ts`
- Modify: `src/components/react/WorkoutLogger/WorkoutLogger.tsx`
- Modify: `src/lib/routines.ts`

- [ ] **Step 1: Agregar el helper en `weekdays.ts`**

Reemplazar:

```ts
export function getTodayWeekday(date: Date = new Date()): Weekday {
  return JS_DAY_TO_WEEKDAY[date.getDay()];
}

export function weekdayLabel(day: Weekday): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}
```

por:

```ts
export function getTodayWeekday(date: Date = new Date()): Weekday {
  return JS_DAY_TO_WEEKDAY[date.getDay()];
}

export function weekdayLabel(day: Weekday): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

// Local calendar date as "YYYY-MM-DD" — deliberately not toISOString(),
// which converts to UTC first and can show tomorrow's date once local time
// crosses into the evening (e.g. from ~18:00 onward in a UTC-6 timezone
// like Mexico City).
export function localDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

- [ ] **Step 2: Usar el helper en `WorkoutLogger.tsx` — import**

Reemplazar:

```ts
import {
  entryActivityId,
  entryTarget,
  getTodayWeekday,
  targetSummary,
  type RoutineActivityTarget,
  type RoutineDays,
} from '../../../lib/weekdays';
```

por:

```ts
import {
  entryActivityId,
  entryTarget,
  getTodayWeekday,
  localDateStr,
  targetSummary,
  type RoutineActivityTarget,
  type RoutineDays,
} from '../../../lib/weekdays';
```

- [ ] **Step 3: Usar el helper en `WorkoutLogger.tsx` — el estado `date`**

Reemplazar:

```ts
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
```

por:

```ts
  const [date, setDate] = useState(() => localDateStr());
```

- [ ] **Step 4: Usar el helper en `WorkoutLogger.tsx` — el título "Hoy toca"**

Reemplazar:

```tsx
          title={date === new Date().toISOString().slice(0, 10) ? 'Hoy toca' : 'Ese día toca'}
```

por:

```tsx
          title={date === localDateStr() ? 'Hoy toca' : 'Ese día toca'}
```

- [ ] **Step 5: Usar el helper en `routines.ts` — import**

Reemplazar:

```ts
import { supabase } from './supabase';
import type { ActiveRoutine, Routine } from '../types/db';
import type { RoutineDays } from './weekdays';
import { isNetworkError, readCache, writeCache } from './offlineQueue';
```

por:

```ts
import { supabase } from './supabase';
import type { ActiveRoutine, Routine } from '../types/db';
import { localDateStr, type RoutineDays } from './weekdays';
import { isNetworkError, readCache, writeCache } from './offlineQueue';
```

- [ ] **Step 6: Usar el helper en `routines.ts` — `activateRoutine`**

Reemplazar:

```ts
      started_at: new Date().toISOString().slice(0, 10),
```

por:

```ts
      started_at: localDateStr(),
```

- [ ] **Step 7: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio. `tsc` limpio salvo el error preexistente y no relacionado de `ProgressList.tsx`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/weekdays.ts src/components/react/WorkoutLogger/WorkoutLogger.tsx src/lib/routines.ts
git commit -m "fix: use local calendar date instead of UTC for today's date"
```

---

### Task 2: "Días cumplidos" cuenta cualquier día entrenado

**Files:**
- Modify: `src/lib/adherence.ts`
- Modify: `src/components/react/RoutineManager/RoutineManager.tsx`

**Contexto:** hoy `weekAdherence(routineDays, workoutDates)` solo cuenta un día si la rutina activa tiene algo programado ese día — sábado y domingo quedan siempre afuera porque todas las rutinas actuales los marcan como descanso. Se confirmó con el usuario (`AskUserQuestion`) que el número debe pasar a contar cualquier día entrenado esta semana, sin mirar qué programaba la rutina.

- [ ] **Step 1: Reescribir `adherence.ts` completo**

Reemplazar el archivo completo:

```ts
import { getTodayWeekday, type RoutineDays } from './weekdays';

export interface WeekAdherence {
  scheduledDays: number; // routine days from Monday..today that have already happened
  completedDays: number; // of those, how many have a logged workout
}

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Local calendar date as "YYYY-MM-DD" — deliberately not toISOString(),
// which converts to UTC first and can shift the date near midnight.
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Adherence for the current calendar week (Monday..today only) — future
// scheduled days haven't happened yet, so they shouldn't count against you.
export function weekAdherence(routineDays: RoutineDays, workoutDates: Set<string>): WeekAdherence {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = mondayOf(today);

  let scheduledDays = 0;
  let completedDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    if (d > today) break;
    const weekday = getTodayWeekday(d);
    if (routineDays[weekday].length === 0) continue;
    scheduledDays++;
    if (workoutDates.has(localDateStr(d))) completedDays++;
  }
  return { scheduledDays, completedDays };
}
```

por:

```ts
import { localDateStr } from './weekdays';

export interface WeekAdherence {
  daysElapsed: number; // days from Monday..today that have already happened
  daysTrained: number; // of those, how many have a logged workout
}

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Training days for the current calendar week (Monday..today only) — future
// days haven't happened yet, so they shouldn't count against you. Counts any
// day with a logged workout, regardless of what (if anything) the active
// routine scheduled for that day — this is "days trained this week", not
// "adherence to the routine's own schedule" (that distinction was an
// explicit product decision, not the original behavior).
export function weekAdherence(workoutDates: Set<string>): WeekAdherence {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = mondayOf(today);

  let daysElapsed = 0;
  let daysTrained = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    if (d > today) break;
    daysElapsed++;
    if (workoutDates.has(localDateStr(d))) daysTrained++;
  }
  return { daysElapsed, daysTrained };
}
```

- [ ] **Step 2: Actualizar la llamada en `RoutineManager.tsx`**

Reemplazar:

```ts
  const activeRoutineDays: RoutineDays | null =
    activeRoutine?.source === 'predefined'
      ? predefinedRoutines.find((p) => p.id === activeRoutine.routine_ref)?.days ?? null
      : activeCustomRoutine?.days ?? null;
  const adherence = activeRoutineDays ? weekAdherence(activeRoutineDays, workoutDates) : null;
```

por:

```ts
  const adherence = activeRoutine ? weekAdherence(workoutDates) : null;
```

- [ ] **Step 3: Actualizar los nombres de campo en el JSX**

Reemplazar:

```tsx
              {adherence && adherence.scheduledDays > 0 && (
                <p className="font-mono text-sm text-paper-dim">
                  Esta semana: {adherence.completedDays} de {adherence.scheduledDays} días
                  cumplidos
                </p>
              )}
```

por:

```tsx
              {adherence && adherence.daysElapsed > 0 && (
                <p className="font-mono text-sm text-paper-dim">
                  Esta semana: {adherence.daysTrained} de {adherence.daysElapsed} días
                  cumplidos
                </p>
              )}
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio. `tsc` limpio salvo el error preexistente y no relacionado de `ProgressList.tsx`. Si `RoutineDays` quedó sin otro uso en `RoutineManager.tsx`, `tsc` no tira error por un import de tipo sin usar (no es `noUnusedLocals`), pero confirmar igual con `grep -n "RoutineDays" src/components/react/RoutineManager/RoutineManager.tsx` que sigue usándose en otro lado (la interface `PredefinedRoutine` y la función `isGymPlan` ya lo usan, así que el import no debería tocarse).

- [ ] **Step 5: Commit**

```bash
git add src/lib/adherence.ts src/components/react/RoutineManager/RoutineManager.tsx
git commit -m "feat: count any trained day toward weekly adherence, not just scheduled ones"
```

---

### Task 3: Verificación manual end-to-end + documentación

**Files:** `docs/roadmap-ideas.md` (si corresponde — este no es un ítem del backlog compilado, es un bug reportado en vivo, así que probablemente no haga falta tocarlo), `docs/agents/fecha-local-y-dias-entrenados-status.md` (nuevo)

- [ ] **Step 1: Confirmar que el build completo sigue limpio**

Run: `npm run build && npx tsc --noEmit`
Expected: igual que en los tasks anteriores.

- [ ] **Step 2: Confirmar que no queda ningún otro uso de `toISOString().slice` o `getUTC*` para fechas de calendario**

```bash
grep -rn "toISOString().slice\|getUTC" --include="*.ts" --include="*.tsx" --include="*.astro" src/
```

Expected: sin resultados (los tres usos que existían ya se reemplazaron en el Task 1).

- [ ] **Step 3: Preparar la cuenta de prueba**

Mismo patrón que sesiones anteriores (ver `docs/agents/notas-de-entorno-y-lecciones.md`): escribir a un archivo y correr

```sql
UPDATE auth.users SET encrypted_password = crypt('<nueva-clave>', gen_salt('bf')) WHERE email = 'crud-e2e-1786826288@gmail.com';
```

vía `supabase db query --linked --file <archivo.sql>`. Si el clasificador de auto-mode lo bloquea, pedirle al usuario que lo corra con `!`.

- [ ] **Step 4: Confirmar que la cuenta de prueba tiene una rutina activa que no programa fin de semana**

```bash
supabase db query --linked "select source, routine_ref from active_routines ar join auth.users u on u.id = ar.user_id where u.email = 'crud-e2e-1786826288@gmail.com';"
```

Cualquier rutina predefinida actual (`full-body`, `push-pull-legs`, y sus variantes por sexo) sirve — ninguna programa sábado/domingo. Si la cuenta no tiene una rutina activa en este momento, activar cualquiera predefinida desde `/rutinas/` antes de seguir.

- [ ] **Step 5: Playwright — un entrenamiento de fin de semana ahora cuenta**

Con `npx astro preview` corriendo (build ya hecho en Step 1): loguear con la cuenta de prueba, ir a `/registro/nuevo/`, cambiar el campo Fecha a un sábado o domingo de la semana actual (calcular la fecha exacta según el día de hoy), agregar cualquier serie de gym, guardar. Ir a `/rutinas/` y confirmar que "Esta semana: X de Y días cumplidos" aumentó en 1 respecto a antes de guardar ese entrenamiento — antes del fix, ese día de fin de semana nunca hubiera sumado.

- [ ] **Step 6: Limpiar el entrenamiento de prueba**

Borrar desde `/progreso/` (historial de entrenamientos) el entrenamiento de fin de semana creado en el Step 5, para no dejar datos de prueba acumulados en la cuenta reutilizable.

- [ ] **Step 7: Actualizar la documentación de la sesión**

Crear `docs/agents/fecha-local-y-dias-entrenados-status.md`:

````md
# Fecha local (CDMX) y días entrenados — status

**Fecha:** 2026-08-20
**Pedido:** dos bugs reportados en vivo por el usuario: (1) la app mostraba la fecha adelantada un día por la noche en CDMX; (2) el conteo de "días cumplidos" en Rutinas no incluía entrenamientos de fin de semana. Investigados con `systematic-debugging` antes de proponer cualquier fix. Proceso: root cause → spec (`docs/superpowers/specs/2026-08-20-fecha-local-y-dias-entrenados-design.md`) → plan (`docs/superpowers/plans/2026-08-20-fecha-local-y-dias-entrenados.md`) → implementación con subagent-driven-development.

## Qué se hizo

**Bug 1 (root cause):** tres lugares calculaban "hoy" con `new Date().toISOString().slice(0, 10)`, que convierte a UTC antes de cortar la fecha — a partir de ~18:00 hora CDMX (UTC-6) el reloj UTC ya cruzó la medianoche y muestra el día siguiente. Afectaba el campo Fecha de Registrar (un entrenamiento de noche podía guardarse bajo la fecha equivocada), el título "Hoy toca"/"Ese día toca", y `started_at` al activar una rutina. Se agregó `localDateStr()` en `src/lib/weekdays.ts` (fecha local correcta, sin pasar por UTC) y se reemplazaron los tres usos, más la copia privada equivalente que ya existía en `src/lib/adherence.ts`.

**Bug 2 (decisión de producto, no bug de lógica):** `weekAdherence()` solo contaba un día si la rutina activa tenía algo programado ese día — todas las rutinas actuales marcan sábado/domingo como descanso, así que un entrenamiento real de fin de semana nunca sumaba al conteo, aunque se guardara bien en la base. Confirmado con el usuario que el número debía pasar a contar cualquier día entrenado esta semana, sin filtrar por lo que programaba la rutina. `weekAdherence` dejó de recibir `routineDays`; los campos se renombraron (`scheduledDays`→`daysElapsed`, `completedDays`→`daysTrained`) porque el nombre viejo ya no describía lo que miden.

## Verificación

- `npm run build` + `npx tsc --noEmit` limpios en cada task (único error preexistente esperado en `ProgressList.tsx`).
- Búsqueda exhaustiva confirmando que no queda ningún otro `toISOString().slice`/`getUTC*` para fechas de calendario en `src/`.
- Playwright contra la cuenta de prueba real: registrar un entrenamiento en una fecha de fin de semana con una rutina activa que no programa esos días — confirmado que "Esta semana: X de Y días cumplidos" ahora lo refleja. Entrenamiento de prueba borrado al terminar.

## Lo que falta / no cubierto en esta ronda

- Nada — ambos bugs reportados quedaron resueltos.
````

- [ ] **Step 8: Commit**

```bash
git add docs/agents/fecha-local-y-dias-entrenados-status.md
git commit -m "docs: log local date fix and weekly training-days count change"
```
