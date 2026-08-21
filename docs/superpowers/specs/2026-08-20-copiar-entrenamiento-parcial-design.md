# Copiar entrenamiento parcial — diseño

Ítem de deuda técnica de `docs/roadmap-ideas.md` (bullet "Registrar / copiar entrenamiento"): "copiar un entrenamiento anterior" es todo-o-nada, no se pueden elegir series/sesiones sueltas. Elegido directamente por el usuario de la lista de deuda técnica — se acotó explícitamente a solo esta parte del bullet, dejando afuera el otro ítem del mismo bullet (presets de duración/distancia fijos por disciplina).

**Pedido:** al copiar un día anterior en Registrar, poder elegir series/sesiones sueltas de ese día en vez de copiar todo de una vez.

**Explícitamente fuera de esta ronda:**
- Los presets de duración/distancia de `SessionFields` (que no varían por disciplina) — otro ítem separado del mismo bullet de deuda técnica, no se toca acá.
- Copiar entre varios días a la vez (elegir ítems de más de un día anterior en una sola operación) — el pedido es sobre selección parcial *dentro* del día ya elegido, no sobre expandir qué días se pueden combinar.
- Cualquier cambio a cómo se calculan/muestran las series ya guardadas hoy, o a `WorkoutHistory.tsx` — el formato de texto de cada fila se toma prestado de ahí (mismo texto, no lógica compartida) pero no se refactoriza ese archivo.

## Enfoque técnico elegido

**Checklist con todo tildado por defecto, no un segundo picker.** Después de elegir el día en el `<select>` que ya existe, aparece una lista con una fila por serie de gym y por sesión de otra disciplina de ese día, cada una con un checkbox, todas tildadas al abrir. El botón "Copiar a este día" pasa a decir "Copiar seleccionados (N)" y queda deshabilitado si `N = 0`. Esto preserva el caso común (copiar todo el día) en un solo click extra de intención cero — el usuario no tiene que tildar nada si quiere todo — mientras habilita destildar lo que no quiere antes de copiar.

Se eligió "todo tildado por defecto" (confirmado con el usuario) en vez de "nada tildado, hay que elegir": arrancar vacío obligaría a tildar todo a mano incluso para el caso de copiar el día completo, agregando fricción al camino más común sin necesidad.

**Identidad de cada fila = el `id` real de la fila en la base**, no un índice de array. `WorkoutSet`/`WorkoutSession` (`src/types/db.ts`) ya tienen `id: string` — se usa directamente como key de React y como valor en dos `Set<string>` de selección (uno para series, uno para sesiones), sin inventar ningún identificador nuevo.

**Reinicio de selección al cambiar de día**: si el usuario cambia el `<select>` de día, ambos `Set` de selección se vacían y se re-llenan con todos los ids del día nuevo (mismo comportamiento "todo tildado" que al abrir por primera vez) — nunca se arrastra una selección de un día al elegir otro.

## Cambios

**`src/components/react/WorkoutLogger/WorkoutLogger.tsx`**:

- Nuevo estado: `selectedSetIds: Set<string>`, `selectedSessionIds: Set<string>`.
- Nuevo `useEffect` (o lógica en el `onChange` del `<select>` de día) que, cuando cambia `copySourceId`, recalcula ambos `Set` con **todos** los ids de `sets`/`sessions` del `source` correspondiente (mismo `pastWorkouts.find((w) => w.id === copySourceId)` que ya usa `copyWorkout`).
- Nueva lista de checkboxes, renderizada solo cuando `copySourceId` no está vacío, entre el `<select>` y el botón. Cada fila:
  - Series de gym: texto `"{nombre del ejercicio} — serie {set_number}: {reps} reps x {peso en la unidad del usuario} {unidad}{, RPE {rpe} si no es null}"` — mismo formato exacto que la fila de solo-lectura en `src/components/react/ProgressList/WorkoutHistory.tsx` (línea ~114), incluida la conversión de unidad vía `kgToDisplay`/`getWeightUnit` de `src/lib/weightUnit.ts` (mismo patrón ya usado en todo el proyecto: guardar siempre en kg, convertir solo en el borde de la UI).
  - Sesiones: texto `"{nombre de la actividad} — {distancia si no es null: '{metros} m en '}{duration_min} min"` — mismo formato que `WorkoutHistory.tsx` (línea ~219-220), con `kmToMeters` de `src/lib/activities.ts` para la conversión.
  - Checkbox controlado por `selectedSetIds.has(set.id)` / `selectedSessionIds.has(session.id)`, `onChange` agrega/saca ese id del `Set` correspondiente.
- `copyWorkout(workoutId: string)` cambia de firma a `copyWorkout(workoutId: string, setIds: Set<string>, sessionIds: Set<string>)`: filtra `source.sets`/`source.sessions` por `setIds.has(s.id)` / `sessionIds.has(s.id)` antes del `.map(...)` que arma los `LoggedSet`/`LoggedSession` — el resto de la función (cálculo de `setNumber` por ejercicio, resolución de nombre vía `activityById`) no cambia.
- El botón pasa de `"Copiar a este día"` (siempre habilitado si hay `copySourceId`) a `` `Copiar seleccionados (${selectedSetIds.size + selectedSessionIds.size})` `` — `disabled` si esa suma es `0`.

## Verificación

- `npm run build` + `npx tsc --noEmit` limpios.
- Playwright contra Supabase real: crear un día de prueba con al menos 2 series de gym de ejercicios distintos y 1 sesión de otra disciplina; en un día nuevo, abrir "Copiar un entrenamiento anterior", elegir ese día — confirmar que aparecen las 3 filas, todas tildadas. Destildar una serie, click "Copiar seleccionados (2)" — confirmar que el borrador de hoy solo recibe las 2 series/sesión tildadas, no la destildada. Cambiar de día en el `<select>` (a otro día con datos) y confirmar que la lista se re-tilda completa para el día nuevo, sin arrastrar la selección anterior.
