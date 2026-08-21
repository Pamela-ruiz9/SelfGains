# Copiar entrenamiento parcial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En "Copiar un entrenamiento anterior" (Registrar), después de elegir un día aparece una lista con cada serie/sesión de ese día, todas tildadas por defecto — el usuario puede destildar lo que no quiere antes de copiar, en vez de copiar todo el día siempre.

**Architecture:** Todo el cambio vive en `WorkoutLogger.tsx`. Dos `Set<string>` de ids seleccionados (uno para series, uno para sesiones) en el estado del componente, re-llenados con "todos los ids del día" cada vez que cambia el día elegido. `copyWorkout` pasa a recibir esos dos `Set` y filtra `source.sets`/`source.sessions` por ellos antes de armar los `LoggedSet`/`LoggedSession` — el resto de su lógica (numeración de series, resolución de nombre) no cambia.

**Tech Stack:** React (ya en el stack) — sin dependencias nuevas, sin cambio de schema ni de Supabase.

**Reference:** Diseño completo en `docs/superpowers/specs/2026-08-20-copiar-entrenamiento-parcial-design.md`.

---

## File Structure

- **Modify:** `src/components/react/WorkoutLogger/WorkoutLogger.tsx` — único archivo tocado.

---

### Task 1: Selección parcial al copiar un día anterior

**Files:**
- Modify: `src/components/react/WorkoutLogger/WorkoutLogger.tsx`

- [ ] **Step 1: Agregar el estado de selección**

Reemplazar:

```ts
  const [copySourceId, setCopySourceId] = useState('');
```

por:

```ts
  const [copySourceId, setCopySourceId] = useState('');
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set());
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
```

- [ ] **Step 2: Reescribir `copyWorkout` para filtrar por selección**

Reemplazar:

```ts
  // Copies every set/session from a previously logged day into today's
  // draft in one shot — for a rest day with no routine assigned, or to
  // bolt on a whole other discipline you already have a good log for,
  // without re-typing it one exercise at a time.
  function copyWorkout(workoutId: string) {
    const source = pastWorkouts.find((w) => w.id === workoutId);
    if (!source) return;

    if (source.sets.length > 0) {
      setLoggedSets((prev) => {
        const counts = new Map<string, number>();
        for (const s of prev) counts.set(s.exerciseId, (counts.get(s.exerciseId) ?? 0) + 1);
        const additions: LoggedSet[] = source.sets.map((s) => {
          const activity = activityById.get(s.exercise_id);
          const setNumber = (counts.get(s.exercise_id) ?? 0) + 1;
          counts.set(s.exercise_id, setNumber);
          return {
            exerciseId: s.exercise_id,
            exerciseName: activity ? fullActivityName(activity) : s.exercise_id,
            setNumber,
            reps: s.reps,
            weight: s.weight,
            rpe: s.rpe,
          };
        });
        return [...prev, ...additions];
      });
    }

    if (source.sessions.length > 0) {
      setLoggedSessions((prev) => [
        ...prev,
        ...source.sessions.map((s) => {
          const activity = activityById.get(s.activity_id);
          return {
            activityId: s.activity_id,
            activityName: activity ? fullActivityName(activity) : s.activity_id,
            durationMin: s.duration_min,
            distanceKm: s.distance_km,
          };
        }),
      ]);
    }

    setCopySourceId('');
    setError(null);
    setSavedMessage(null);
  }
```

por:

```ts
  // Copies the selected sets/sessions from a previously logged day into
  // today's draft — for a rest day with no routine assigned, or to bolt on
  // a whole other discipline you already have a good log for, without
  // re-typing it one exercise at a time. Only the ids the user left ticked
  // in the checklist come along; anything they un-ticked is skipped.
  function copyWorkout(workoutId: string, setIds: Set<string>, sessionIds: Set<string>) {
    const source = pastWorkouts.find((w) => w.id === workoutId);
    if (!source) return;

    const setsToCopy = source.sets.filter((s) => setIds.has(s.id));
    const sessionsToCopy = source.sessions.filter((s) => sessionIds.has(s.id));

    if (setsToCopy.length > 0) {
      setLoggedSets((prev) => {
        const counts = new Map<string, number>();
        for (const s of prev) counts.set(s.exerciseId, (counts.get(s.exerciseId) ?? 0) + 1);
        const additions: LoggedSet[] = setsToCopy.map((s) => {
          const activity = activityById.get(s.exercise_id);
          const setNumber = (counts.get(s.exercise_id) ?? 0) + 1;
          counts.set(s.exercise_id, setNumber);
          return {
            exerciseId: s.exercise_id,
            exerciseName: activity ? fullActivityName(activity) : s.exercise_id,
            setNumber,
            reps: s.reps,
            weight: s.weight,
            rpe: s.rpe,
          };
        });
        return [...prev, ...additions];
      });
    }

    if (sessionsToCopy.length > 0) {
      setLoggedSessions((prev) => [
        ...prev,
        ...sessionsToCopy.map((s) => {
          const activity = activityById.get(s.activity_id);
          return {
            activityId: s.activity_id,
            activityName: activity ? fullActivityName(activity) : s.activity_id,
            durationMin: s.duration_min,
            distanceKm: s.distance_km,
          };
        }),
      ]);
    }

    setCopySourceId('');
    setSelectedSetIds(new Set());
    setSelectedSessionIds(new Set());
    setError(null);
    setSavedMessage(null);
  }
```

- [ ] **Step 3: Agregar el handler que re-llena la selección al cambiar de día**

Reemplazar:

```ts
  function disciplinesForPastWorkout(w: WorkoutWithLogs): string[] {
```

por:

```ts
  function handleCopySourceChange(workoutId: string) {
    setCopySourceId(workoutId);
    const source = pastWorkouts.find((w) => w.id === workoutId);
    setSelectedSetIds(new Set(source ? source.sets.map((s) => s.id) : []));
    setSelectedSessionIds(new Set(source ? source.sessions.map((s) => s.id) : []));
  }

  function disciplinesForPastWorkout(w: WorkoutWithLogs): string[] {
```

- [ ] **Step 4: Calcular el día elegido antes del JSX**

Reemplazar:

```ts
        para registrar un entrenamiento.
      </p>
    );
  }

  return (
```

por:

```ts
        para registrar un entrenamiento.
      </p>
    );
  }

  const copySource = pastWorkouts.find((w) => w.id === copySourceId);

  return (
```

- [ ] **Step 5: Reemplazar el JSX de la sección de copiar**

Reemplazar:

```tsx
      {pastWorkouts.length > 0 && (
        <CollapsibleSection
          title="Copiar un entrenamiento anterior"
          open={copySectionOpen}
          onToggle={() => setCopySectionOpen((prev) => !prev)}
        >
          <div className="card-brutal flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="flex flex-1 flex-col gap-2">
              <span className="label-brutal">Día a copiar</span>
              <select
                value={copySourceId}
                onChange={(e) => setCopySourceId(e.target.value)}
                className="input-brutal"
              >
                <option value="">
                  {todayActivities.length === 0
                    ? 'Elige un día para copiar aquí (sin rutina asignada hoy)'
                    : 'Elige un día para sumar otra disciplina hoy'}
                </option>
                {pastWorkouts.map((w) => {
                  const labels = disciplinesForPastWorkout(w).map((id) => LABEL_BY_DISCIPLINE[id] ?? id);
                  return (
                    <option key={w.id} value={w.id}>
                      {w.date}
                      {labels.length > 0 ? ` — ${labels.join(', ')}` : ''}
                    </option>
                  );
                })}
              </select>
            </label>
            <button
              type="button"
              onClick={() => copyWorkout(copySourceId)}
              disabled={!copySourceId}
              className="btn-brutal-sm shrink-0"
            >
              Copiar a este día
            </button>
          </div>
        </CollapsibleSection>
      )}
```

por:

```tsx
      {pastWorkouts.length > 0 && (
        <CollapsibleSection
          title="Copiar un entrenamiento anterior"
          open={copySectionOpen}
          onToggle={() => setCopySectionOpen((prev) => !prev)}
        >
          <div className="card-brutal flex flex-col gap-3">
            <label className="flex flex-col gap-2">
              <span className="label-brutal">Día a copiar</span>
              <select
                value={copySourceId}
                onChange={(e) => handleCopySourceChange(e.target.value)}
                className="input-brutal"
              >
                <option value="">
                  {todayActivities.length === 0
                    ? 'Elige un día para copiar aquí (sin rutina asignada hoy)'
                    : 'Elige un día para sumar otra disciplina hoy'}
                </option>
                {pastWorkouts.map((w) => {
                  const labels = disciplinesForPastWorkout(w).map((id) => LABEL_BY_DISCIPLINE[id] ?? id);
                  return (
                    <option key={w.id} value={w.id}>
                      {w.date}
                      {labels.length > 0 ? ` — ${labels.join(', ')}` : ''}
                    </option>
                  );
                })}
              </select>
            </label>
            {copySource && (
              <div className="flex flex-col gap-2">
                {copySource.sets.map((s) => {
                  const activity = activityById.get(s.exercise_id);
                  const name = activity ? fullActivityName(activity) : s.exercise_id;
                  return (
                    <label key={s.id} className="flex items-center gap-2 font-mono text-sm text-paper">
                      <input
                        type="checkbox"
                        checked={selectedSetIds.has(s.id)}
                        onChange={(e) =>
                          setSelectedSetIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(s.id);
                            else next.delete(s.id);
                            return next;
                          })
                        }
                      />
                      {name} — serie {s.set_number}: {s.reps} reps x {kgToDisplay(s.weight, weightUnit)}{' '}
                      {weightUnit}
                      {s.rpe !== null ? ` (RPE ${s.rpe})` : ''}
                    </label>
                  );
                })}
                {copySource.sessions.map((s) => {
                  const activity = activityById.get(s.activity_id);
                  const name = activity ? fullActivityName(activity) : s.activity_id;
                  return (
                    <label key={s.id} className="flex items-center gap-2 font-mono text-sm text-paper">
                      <input
                        type="checkbox"
                        checked={selectedSessionIds.has(s.id)}
                        onChange={(e) =>
                          setSelectedSessionIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(s.id);
                            else next.delete(s.id);
                            return next;
                          })
                        }
                      />
                      {name} — {s.distance_km !== null ? `${kmToMeters(s.distance_km)} m en ` : ''}
                      {s.duration_min} min
                    </label>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={() => copyWorkout(copySourceId, selectedSetIds, selectedSessionIds)}
              disabled={selectedSetIds.size + selectedSessionIds.size === 0}
              className="btn-brutal-sm shrink-0 self-start"
            >
              Copiar seleccionados ({selectedSetIds.size + selectedSessionIds.size})
            </button>
          </div>
        </CollapsibleSection>
      )}
```

- [ ] **Step 6: Verificar que compila**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio. `tsc` limpio salvo el error preexistente y no relacionado de `ProgressList.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/components/react/WorkoutLogger/WorkoutLogger.tsx
git commit -m "feat: allow selecting individual sets/sessions when copying a past workout"
```

---

### Task 2: Verificación manual end-to-end + documentación

**Files:** `docs/roadmap-ideas.md`, `docs/agents/copiar-entrenamiento-parcial-status.md` (nuevo)

**Contexto:** hace falta una cuenta de prueba con al menos un día ya registrado que tenga 2+ series de gym de ejercicios distintos y 1 sesión de otra disciplina, para poder probar la selección parcial de verdad. `crud-e2e-1786826288@gmail.com` ya tiene entrenamientos previos reales de sesiones anteriores — confirmar con una consulta a la base antes de registrar uno nuevo si hace falta.

- [ ] **Step 1: Confirmar que el build completo sigue limpio**

Run: `npm run build && npx tsc --noEmit`
Expected: igual que en el Task 1.

- [ ] **Step 2: Preparar la cuenta de prueba**

Mismo patrón que sesiones anteriores (ver `docs/agents/notas-de-entorno-y-lecciones.md`): escribir a un archivo y correr

```sql
UPDATE auth.users SET encrypted_password = crypt('<nueva-clave>', gen_salt('bf')) WHERE email = 'crud-e2e-1786826288@gmail.com';
```

vía `supabase db query --linked --file <archivo.sql>`. Si el clasificador de auto-mode lo bloquea, pedirle al usuario que lo corra con `!`.

- [ ] **Step 3: Confirmar (o crear) un día de origen con datos mixtos**

```bash
supabase db query --linked "select w.id, w.date, count(distinct s.exercise_id) as ejercicios_distintos, count(distinct se.id) as sesiones from workouts w join auth.users u on u.id = w.user_id left join workout_sets s on s.workout_id = w.id left join workout_sessions se on se.workout_id = w.id where u.email = 'crud-e2e-1786826288@gmail.com' group by w.id, w.date order by w.date desc limit 5;"
```

Si ningún día tiene al menos 2 `ejercicios_distintos` o si conviene un caso más controlado, registrar uno nuevo con Playwright: loguear con la cuenta de prueba, ir a `/registro/nuevo/`, agregar 2 series de gym de ejercicios distintos (ej. sentadilla y press de banca) y 1 sesión de otra disciplina (ej. running), guardar.

- [ ] **Step 4: Playwright — selección parcial funciona**

En un día distinto al de origen (o el mismo día actual si el de origen es de otra fecha), ir a `/registro/nuevo/`, abrir "Copiar un entrenamiento anterior", elegir el día de origen del Step 3. Confirmar que aparecen todas las filas (2 series + 1 sesión) con checkbox tildado, y que el botón dice "Copiar seleccionados (3)". Destildar una de las series de gym. Confirmar que el botón pasa a decir "Copiar seleccionados (2)". Click "Copiar seleccionados (2)". Confirmar en el borrador de hoy: aparece exactamente 1 serie de gym (la que quedó tildada) + 1 sesión — no la serie destildada.

- [ ] **Step 5: Playwright — cambiar de día re-tilda todo**

Sin guardar el entrenamiento de hoy todavía, volver a abrir "Copiar un entrenamiento anterior" y elegir el mismo día de origen otra vez (o cualquier otro día con datos). Confirmar que la lista vuelve a aparecer con **todas** las filas tildadas — no arrastra la selección parcial del Step 4.

- [ ] **Step 6: Playwright — copiar sin destildar nada sigue copiando todo**

Elegir un día de origen, no tocar ningún checkbox, click "Copiar seleccionados (N)" con N = total de filas. Confirmar que se agregan todas las series/sesiones al borrador de hoy — mismo resultado que el botón viejo "Copiar a este día".

- [ ] **Step 7: Limpiar cualquier entrenamiento de prueba creado en Steps 3-6**

Si se registró un entrenamiento nuevo solo para esta verificación (Step 3 y/o los guardados de Steps 4-6), borrarlo desde `/progreso/` (historial de entrenamientos) para no dejar datos de prueba acumulados en la cuenta reutilizable.

- [ ] **Step 8: Actualizar la documentación de la sesión**

En `docs/roadmap-ideas.md`, dentro del bullet de **Registrar / copiar entrenamiento**, sacar la parte ya resuelta. Revisar el archivo actual antes de editar — puede haber cambiado desde que se escribió este plan. El bullet debería quedar mencionando solo el ítem de presets de duración/distancia por disciplina (explícitamente fuera de esta ronda) y el nuevo status doc.

Crear `docs/agents/copiar-entrenamiento-parcial-status.md`:

````md
# Copiar entrenamiento parcial — status

**Fecha:** 2026-08-20
**Pedido:** ítem de deuda técnica de `docs/roadmap-ideas.md` — "copiar un entrenamiento anterior" en Registrar era todo-o-nada, no se podían elegir series/sesiones sueltas. Elegido directamente por el usuario, acotado explícitamente a solo esta parte del bullet (el otro ítem, presets de duración/distancia por disciplina, queda pendiente). Proceso: brainstorming (una pregunta: estado inicial de los checkboxes) → spec (`docs/superpowers/specs/2026-08-20-copiar-entrenamiento-parcial-design.md`) → plan (`docs/superpowers/plans/2026-08-20-copiar-entrenamiento-parcial.md`) → implementación con subagent-driven-development.

## Qué se hizo

En `WorkoutLogger.tsx`, la sección "Copiar un entrenamiento anterior" ahora muestra, después de elegir un día, una lista con una fila por serie de gym y por sesión de otra disciplina de ese día — mismo formato de texto que ya usa `WorkoutHistory.tsx` para mostrar series/sesiones pasadas, con conversión de unidad de peso vía `kgToDisplay`. Cada fila tiene un checkbox, todas tildadas por defecto al elegir el día (decisión explícita: minimiza fricción para el caso común de copiar todo). El botón pasó de "Copiar a este día" a "Copiar seleccionados (N)", deshabilitado si N=0. Cambiar de día en el selector re-tilda todo para el día nuevo, sin arrastrar la selección anterior.

`copyWorkout` ahora recibe los dos `Set<string>` de ids seleccionados (usando el `id` real de `WorkoutSet`/`WorkoutSession`, ya existente en la base) y filtra antes de armar los `LoggedSet`/`LoggedSession` — el resto de su lógica (numeración de series por ejercicio, resolución de nombre) no cambió.

## Verificación

- `npm run build` + `npx tsc --noEmit` limpios (único error preexistente esperado en `ProgressList.tsx`).
- Playwright contra la cuenta de prueba real: seleccionar un subconjunto y confirmar que solo eso se copia al borrador de hoy; cambiar de día y confirmar que la selección se reinicia a "todo tildado" para el día nuevo; copiar sin destildar nada y confirmar que sigue copiando el día completo (mismo resultado que el botón viejo).

## Lo que falta / no cubierto en esta ronda

- Los presets de duración/distancia de `SessionFields` siguen fijos, no varían por disciplina — otro ítem separado del mismo bullet de deuda técnica original, no se tocó acá.
````

- [ ] **Step 9: Commit**

```bash
git add docs/roadmap-ideas.md docs/agents/copiar-entrenamiento-parcial-status.md
git commit -m "docs: log partial workout copy feature"
```
