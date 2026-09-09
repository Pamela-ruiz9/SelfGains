# 1RM estimado y volumen total en Progreso Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La gráfica de progreso por ejercicio en `/progreso/` pasa de mostrar solo el peso máximo por sesión a mostrar también el 1RM estimado (fórmula de Epley) y el volumen total (peso × reps de todos los sets) de cada día, solo para gimnasio.

**Architecture:** `progressForExercise` en `src/lib/prs.ts` acumula tres valores por fecha en vez de uno (`maxWeight`, `estimated1RM`, `volume`). `ProgressChart.tsx` pasa de `LineChart` (una serie) a `ComposedChart` de Recharts (dos ejes Y: peso a la izquierda con dos líneas, volumen a la derecha con barras), con leyenda y tooltip extendidos a las tres series.

**Tech Stack:** TypeScript/React + Recharts (ya en el stack, `^3.10.1` — no hace falta actualizar versión). Sin dependencias nuevas, sin cambio de schema.

**Reference:** Diseño completo en `docs/superpowers/specs/2026-09-08-1rm-y-volumen-total-design.md`.

---

## File Structure

- **Modify:** `src/lib/prs.ts` — `ProgressPoint` gana `estimated1RM`/`volume`; `progressForExercise` los calcula.
- **Modify:** `src/components/react/ProgressList/ProgressChart.tsx` — `ComposedChart` con dos ejes Y, línea punteada de 1RM, barras de volumen, leyenda, tooltip de tres valores.

Ningún otro archivo cambia: `PRGrid.tsx`, la tarjeta de PR, `CardioProgressChart.tsx` y `CardioPR`/`progressForCardioActivity` quedan igual (cardio no tiene 1RM/volumen — no registra peso×reps).

---

### Task 1: Cálculo de 1RM estimado y volumen en `prs.ts`

**Files:**
- Modify: `src/lib/prs.ts`

- [ ] **Step 1: Actualizar la interfaz `ProgressPoint`**

Reemplazar:

```ts
export interface ProgressPoint {
  date: string;
  maxWeight: number;
}
```

por:

```ts
export interface ProgressPoint {
  date: string;
  maxWeight: number;
  estimated1RM: number;
  volume: number;
}
```

- [ ] **Step 2: Reescribir `progressForExercise`**

Reemplazar:

```ts
// For ONE exercise_id, one point per date with that day's heaviest set,
// sorted chronologically.
export function progressForExercise(
  workouts: WorkoutWithSets[],
  exerciseId: string
): ProgressPoint[] {
  const maxWeightByDate = new Map<string, number>();
  for (const workout of workouts) {
    for (const set of workout.sets) {
      if (set.exercise_id !== exerciseId) continue;
      const current = maxWeightByDate.get(workout.date);
      if (current === undefined || set.weight > current) {
        maxWeightByDate.set(workout.date, set.weight);
      }
    }
  }
  return Array.from(maxWeightByDate.entries())
    .map(([date, maxWeight]) => ({ date, maxWeight }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
```

por:

```ts
// Epley formula: estimated weight liftable for 1 rep given a set actually
// performed at (weight, reps). Overestimates at high rep ranges (20+) — a
// known, accepted limitation, not special-cased.
function estimatedOneRepMax(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

interface DailyExerciseTotals {
  maxWeight: number;
  estimated1RM: number;
  volume: number;
}

// For ONE exercise_id, one point per date, sorted chronologically:
// - maxWeight: the heaviest set that day (unchanged behavior).
// - estimated1RM: the HIGHEST estimated 1RM among that day's sets — not
//   necessarily the set with maxWeight. A 90kg x5 set (1RM ~105kg) can beat
//   a 100kg x1 set (1RM ~103.3kg) on the same day; the 90kg set wins.
// - volume: sum of weight * reps across ALL sets that day, not just the
//   heaviest.
export function progressForExercise(
  workouts: WorkoutWithSets[],
  exerciseId: string
): ProgressPoint[] {
  const totalsByDate = new Map<string, DailyExerciseTotals>();
  for (const workout of workouts) {
    for (const set of workout.sets) {
      if (set.exercise_id !== exerciseId) continue;
      const current = totalsByDate.get(workout.date) ?? {
        maxWeight: 0,
        estimated1RM: 0,
        volume: 0,
      };
      totalsByDate.set(workout.date, {
        maxWeight: Math.max(current.maxWeight, set.weight),
        estimated1RM: Math.max(current.estimated1RM, estimatedOneRepMax(set.weight, set.reps)),
        volume: current.volume + set.weight * set.reps,
      });
    }
  }
  return Array.from(totalsByDate.entries())
    .map(([date, totals]) => ({
      date,
      maxWeight: totals.maxWeight,
      estimated1RM: Math.round(totals.estimated1RM * 10) / 10,
      volume: totals.volume,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio. `tsc` limpio salvo el error preexistente y no relacionado de `ProgressList.tsx:162` (ver `docs/agents/notas-de-entorno-y-lecciones.md`). `ProgressChart.tsx` no debería romperse todavía: hoy solo lee `p.maxWeight` y copia el resto del objeto con spread, así que los campos nuevos de `ProgressPoint` no le generan error de tipos aunque no los use hasta el Task 2.

- [ ] **Step 4: Commit**

```bash
git add src/lib/prs.ts
git commit -m "feat: compute estimated 1RM and daily volume in progressForExercise"
```

---

### Task 2: `ProgressChart.tsx` — gráfica compuesta con 1RM y volumen

**Files:**
- Modify: `src/components/react/ProgressList/ProgressChart.tsx`

- [ ] **Step 1: Reescribir el archivo completo**

Reemplazar todo el contenido de `src/components/react/ProgressList/ProgressChart.tsx` por:

```tsx
import { useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ProgressPoint } from '../../../lib/prs';
import { getWeightUnit, kgToDisplay } from '../../../lib/weightUnit';

interface ExerciseInfo {
  id: string;
  name: string;
}

interface Props {
  exerciseId: string;
  points: ProgressPoint[];
  exercises: ExerciseInfo[];
  onSelectExercise: (id: string) => void;
}

function ChartTooltip({
  active,
  payload,
  label,
  weightUnit,
}: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
  weightUnit: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="card-brutal font-mono text-sm">
      <p className="text-paper-dim">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value} {weightUnit}
        </p>
      ))}
    </div>
  );
}

export default function ProgressChart({ exerciseId, points, exercises, onSelectExercise }: Props) {
  const [weightUnit] = useState(() => getWeightUnit());
  const exerciseName = exercises.find((e) => e.id === exerciseId)?.name ?? exerciseId;
  const displayPoints = points.map((p) => ({
    ...p,
    maxWeight: kgToDisplay(p.maxWeight, weightUnit),
    estimated1RM: kgToDisplay(p.estimated1RM, weightUnit),
    volume: kgToDisplay(p.volume, weightUnit),
  }));

  return (
    <div className="flex flex-col gap-4">
      <label className="flex max-w-xs flex-col gap-2">
        <span className="label-brutal">Ejercicio</span>
        <select
          value={exerciseId}
          onChange={(e) => onSelectExercise(e.target.value)}
          className="input-brutal"
        >
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
      </label>
      <div className="card-brutal">
        <p className="mb-4 font-display text-2xl text-paper">{exerciseName}</p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={displayPoints} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid stroke="var(--color-paper-dim)" strokeOpacity={0.2} vertical={false} />
              <XAxis
                dataKey="date"
                stroke="var(--color-paper-dim)"
                tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
              />
              <YAxis
                yAxisId="weight"
                stroke="var(--color-paper-dim)"
                tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                unit={` ${weightUnit}`}
              />
              <YAxis
                yAxisId="volume"
                orientation="right"
                stroke="var(--color-paper-dim)"
                tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                unit={` ${weightUnit}`}
              />
              <Tooltip content={<ChartTooltip weightUnit={weightUnit} />} />
              <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }} />
              <Bar
                yAxisId="volume"
                dataKey="volume"
                name="Volumen"
                fill="var(--color-paper-dim)"
                fillOpacity={0.35}
              />
              <Line
                yAxisId="weight"
                type="monotone"
                dataKey="maxWeight"
                name="Peso máximo"
                stroke="var(--color-acid)"
                strokeWidth={2}
                dot={{ r: 4, fill: 'var(--color-acid)' }}
                activeDot={{ r: 6 }}
              />
              <Line
                yAxisId="weight"
                type="monotone"
                dataKey="estimated1RM"
                name="1RM estimado"
                stroke="var(--color-blood)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 4, fill: 'var(--color-blood)' }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
```

Notas sobre este cambio respecto al archivo viejo:
- El `Bar` de volumen se declara antes que los dos `Line` — en Recharts el orden de los hijos define el z-order de renderizado, así que declararlo primero lo deja detrás de las líneas (igual que pide el spec).
- `yAxisId="weight"` es el eje izquierdo (peso máximo + 1RM estimado, ambos en la unidad elegida por el usuario); `yAxisId="volume"` es el eje derecho (barras de volumen, misma unidad — "kg totales" o "lb totales" según preferencia).
- `--color-blood` ya existe en `src/styles/global.css` (usado para indicar "estimado/no medido directo", distinto del `--color-acid` de un dato medido).

- [ ] **Step 2: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio. `tsc` limpio salvo el error preexistente y no relacionado de `ProgressList.tsx:162`. Esta vez no debe quedar ningún error en `prs.ts` ni en `ProgressChart.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/react/ProgressList/ProgressChart.tsx
git commit -m "feat: show estimated 1RM and volume in the exercise progress chart"
```

---

### Task 3: Verificación manual end-to-end + documentación

**Files:** `docs/agents/1rm-y-volumen-total-status.md` (nuevo)

- [ ] **Step 1: Confirmar que el build completo sigue limpio**

Run: `npm run build && npx tsc --noEmit`
Expected: igual que en los tasks anteriores — limpio salvo el error preexistente de `ProgressList.tsx:162`.

- [ ] **Step 2: Matar procesos zombie de corridas anteriores antes de levantar el servidor**

```bash
ps aux | grep -E "astro dev|esbuild" | grep -v grep
```

Si aparece algún proceso de una corrida anterior, matarlo (`kill -9 <pid>`) antes de continuar — ver `docs/agents/notas-de-entorno-y-lecciones.md` sección "Servidor de dev: procesos zombie".

- [ ] **Step 3: Preparar la cuenta de prueba**

Reusar la cuenta ya confirmada `crud-e2e-1786826288@gmail.com` (patrón establecido, ver `docs/agents/notas-de-entorno-y-lecciones.md`). Resetear su contraseña vía:

```sql
UPDATE auth.users SET encrypted_password = crypt('<nueva-clave>', gen_salt('bf')) WHERE email = 'crud-e2e-1786826288@gmail.com';
```

corrido con `supabase db query --linked --file <archivo.sql>`. Si el clasificador de auto-mode bloquea el comando, pedirle al usuario que lo corra con `!`.

- [ ] **Step 4: Cargar datos de prueba con múltiples sets de distinto peso/reps en la misma sesión**

Con `npx astro preview` corriendo (build ya hecho en Step 1): loguear con la cuenta de prueba, ir a `/registro/nuevo/`, y para un mismo ejercicio de gym (ej. "Sentadilla") registrar en una sesión al menos dos sets con pesos/reps distintos donde el set más pesado NO tenga el mayor 1RM estimado — por ejemplo:

- Set A: 100kg x 1 rep → 1RM estimado ≈ 103.3kg
- Set B: 90kg x 5 reps → 1RM estimado ≈ 105kg

Guardar. Repetir el mismo ejercicio en al menos otra fecha distinta (otro día) con un peso distinto, para tener más de un punto en la gráfica.

- [ ] **Step 5: Playwright — confirmar la gráfica en `/progreso/`**

Ir a `/progreso/`, abrir la sección "Disciplina" → Gym, tocar el ejercicio usado en el Step 4 para abrir su gráfica inline. Confirmar visualmente (captura de pantalla):

- Se ven tres series: línea sólida "Peso máximo", línea punteada "1RM estimado", barras "Volumen".
- La leyenda muestra los tres nombres.
- En el punto de la sesión con los sets A/B del Step 4, el valor de "Peso máximo" es 100kg pero el de "1RM estimado" corresponde al set de 90kg×5 (≈105kg, más alto que el 1RM de 100kg×1 ≈103.3kg) — confirma que el cálculo no asume que el set más pesado da el mejor 1RM.
- El tooltip al pasar el mouse (o tocar, en Playwright usar hover) sobre ese punto muestra los tres valores con su unidad.
- El volumen de ese día es la suma de ambos sets: `100×1 + 90×5 = 550` (antes de conversión de unidad si la cuenta está en lb).

- [ ] **Step 6: Repetir con preferencia de unidad en lb**

Cambiar la preferencia de unidad de peso a lb (desde donde esté ese control en Perfil/ajustes), volver a `/progreso/` y confirmar que las tres series y el tooltip muestran los valores convertidos a lb, no kg.

- [ ] **Step 7: Limpiar los datos de prueba**

Borrar desde `/progreso/` (historial de entrenamientos) los entrenamientos de prueba creados en el Step 4, y devolver la preferencia de unidad a como estaba antes del Step 6, para no dejar datos ni configuración de prueba en la cuenta reutilizable.

- [ ] **Step 8: Documentar la sesión**

Crear `docs/agents/1rm-y-volumen-total-status.md`:

````md
# 1RM estimado y volumen total en Progreso — status

**Fecha:** 2026-09-09
**Pedido:** ítem de deuda técnica en `docs/roadmap-ideas.md` ("Progreso": "no hay 1RM estimado; no hay gráfico de volumen total"). Proceso: spec (`docs/superpowers/specs/2026-09-08-1rm-y-volumen-total-design.md`) → plan (`docs/superpowers/plans/2026-09-08-1rm-y-volumen-total.md`) → implementación con subagent-driven-development.

## Qué se hizo

`progressForExercise` (`src/lib/prs.ts`) ahora acumula, por cada fecha en que se logueó el ejercicio, el 1RM estimado más alto entre todos los sets de ese día (fórmula de Epley: `weight * (1 + reps / 30)`) y el volumen total (`peso × reps` sumado de todos los sets, no solo el más pesado) además del peso máximo que ya calculaba. `ProgressChart.tsx` pasó de `LineChart` a `ComposedChart` de Recharts con dos ejes Y: el izquierdo con la línea sólida de peso máximo y una nueva línea punteada de 1RM estimado (para diferenciarla visualmente de un dato medido), el derecho con barras de volumen detrás de las líneas. Se agregó leyenda y el tooltip pasó a mostrar las tres series. Solo gimnasio — cardio no tiene el concepto (no registra peso×reps), así que `CardioProgressChart.tsx` no se tocó.

## Verificación

- `npm run build` + `npx tsc --noEmit` limpios en cada task (único error preexistente esperado en `ProgressList.tsx:162`).
- Playwright contra la cuenta de prueba real (`crud-e2e-1786826288@gmail.com`): un ejercicio con sets de distinto peso/reps en la misma sesión confirmó que el punto de 1RM elige el set de mayor 1RM estimado (90kg×5) y no el más pesado (100kg×1), que el volumen suma ambos sets, y que las tres series + leyenda + tooltip se ven correctamente. Repetido con la preferencia de unidad en lb para confirmar la conversión. Datos de prueba borrados y preferencia de unidad restaurada al terminar.

## Lo que falta / no cubierto en esta ronda

Explícitamente fuera de alcance (spec): volumen agregado de todos los ejercicios en un día, comparar/superponer más de un ejercicio en la misma gráfica, filtro por rango de fechas, fórmula alternativa configurable (solo Epley).
````

- [ ] **Step 9: Commit**

```bash
git add docs/agents/1rm-y-volumen-total-status.md
git commit -m "docs: log 1RM estimado y volumen total implementation"
```
