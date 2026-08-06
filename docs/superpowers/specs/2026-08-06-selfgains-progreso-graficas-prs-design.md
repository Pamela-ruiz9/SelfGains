# SelfGains — Gráficas de progreso y cálculo de PRs

## Visión

Cierra el último ítem del roadmap original ("Gráficas de progreso y cálculo de PRs"). Hoy `/progreso/` es una lista plana de entrenamientos por fecha — todo el dato para PRs y gráficas ya existe en `workouts`/`workout_sets`, simplemente nunca se agregó ni se visualizó. Este corte agrega, arriba de esa lista (que se mantiene sin cambios):

1. Una grilla de récords personales (PR) por ejercicio, agrupada por músculo.
2. Una gráfica de progreso de peso máximo a lo largo del tiempo, para un ejercicio elegido de un dropdown.

## Decisiones de alcance

- **PR = peso máximo levantado.** La serie con más peso jamás registrada para ese ejercicio, sin importar las reps ni el RPE. No se calcula 1RM estimado.
- **La gráfica muestra peso máximo por sesión, no volumen.** Por cada fecha en la que se entrenó ese ejercicio, el punto es la serie más pesada de ese día (mismo número que alimenta el PR, así el punto más alto de la gráfica y el PR coinciden visualmente).
- **Todo se calcula del lado del cliente.** Sin cambios de schema ni funciones SQL nuevas — se reutilizan `getWorkoutsForCurrentUser`/`getSetsForWorkout` (ya usadas por `ProgressList`) y se agrega por `exercise_id`/fecha en el navegador. El volumen de datos de una bitácora personal es chico; no hay necesidad de mover este cálculo al servidor.
- **La grilla de PRs solo muestra ejercicios ya entrenados**, agrupados por el músculo principal de cada uno (el primer id en `muscles: string[]` del content collection de ejercicios — ej. "Dominadas" con `[dorsales, biceps, antebrazo]` cae bajo "Dorsales"), usando las secciones de la taxonomía de 17 músculos ya existente (`src/lib/muscles.ts`).
- **La gráfica arranca con el primer ejercicio de la grilla ya seleccionado** (no un estado vacío) — da resultado visual inmediato al entrar a la página en vez de una gráfica en blanco esperando que el usuario elija algo.
- **Se agrega Recharts como dependencia nueva** para el `LineChart`, en vez de dibujar SVG a mano — decisión explícita del usuario, aceptando el mismo trade-off de peso al bundle que ya se aceptó con `three.js` para el explorador muscular.
- **Una sola serie por gráfica** (un ejercicio a la vez) — sin leyenda (el título ya nombra la serie), sin paleta categórica multi-color. Solo el verde `acid` que ya usa el resto del sitio para resaltar.
- **El historial de entrenamientos por fecha que ya existe (`ProgressList` tal como está hoy) se mantiene sin cambios**, debajo de las dos secciones nuevas.

## Modelo de datos

No hay cambios de schema. Se agrega lógica de agregación pura (sin I/O) sobre los mismos tipos `Workout`/`WorkoutSet` que ya existen:

```ts
// src/lib/prs.ts

interface ExercisePR {
  exerciseId: string;
  weight: number;
  date: string; // la fecha del workout donde se logró
}

interface ProgressPoint {
  date: string;
  maxWeight: number;
}

// Por cada exercise_id, la serie de mayor peso en cualquier set/fecha.
function calculatePRs(workouts: WorkoutWithSets[]): ExercisePR[]

// Para UN exercise_id, un punto por fecha con el peso máximo de ese día,
// ordenado cronológicamente.
function progressForExercise(workouts: WorkoutWithSets[], exerciseId: string): ProgressPoint[]
```

`WorkoutWithSets` es el mismo shape que `ProgressList.tsx` ya arma (`Workout & { sets: WorkoutSet[] }`) — estas funciones son puras (reciben los datos ya cargados, no llaman a Supabase), así que son triviales de razonar y no duplican el fetching existente.

## Componentes

```
src/
├── lib/
│   └── prs.ts                              # calculatePRs, progressForExercise (nuevo)
├── components/react/
│   └── ProgressList/
│       ├── ProgressList.tsx                # + monta PRGrid y ProgressChart (tocado)
│       ├── PRGrid.tsx                      # grilla de PRs agrupada por músculo (nuevo)
│       └── ProgressChart.tsx               # dropdown + LineChart de Recharts (nuevo)
└── pages/
    └── progreso/
        └── index.astro                     # + prop `exercises` con músculo (tocado, mínimo)
```

**`lib/prs.ts`** — dos funciones puras, sin dependencias de Supabase ni de React. Se testean mentalmente fácil: `calculatePRs` es un `reduce` por `exercise_id` quedándose con el peso mayor; `progressForExercise` filtra sets de ese ejercicio, agrupa por fecha del workout tomando el máximo, y ordena por fecha.

**`PRGrid.tsx`** — props: `prs: ExercisePR[]`, `exercises: { id, name, muscle }[]`. Agrupa por `muscle` en el orden de `MUSCLES` (`src/lib/muscles.ts`), renderiza una sección por músculo con al menos un PR, cada una con tarjetas `{nombre del ejercicio} · {peso} kg · {fecha}`. Dispara `onSelectExercise(exerciseId)` al clickear una tarjeta (mismo patrón de "click para seleccionar" que ya usa `MuscleExplorer`).

**`ProgressChart.tsx`** — props: `exerciseId: string`, `points: ProgressPoint[]`, `exercises: { id, name }[]` (para poblar el dropdown), `onSelectExercise: (id: string) => void`. Un `<select>` (mismo `input-brutal` que el resto del sitio) para cambiar de ejercicio — su `onChange` llama a `onSelectExercise`, el mismo callback que usa `PRGrid`, así que ambos caminos (clickear una tarjeta o elegir del dropdown) actualizan el mismo `selectedExerciseId` en `ProgressList` — arriba de un `ResponsiveContainer` + `LineChart` de Recharts: eje X = fecha, eje Y = peso (kg), una sola `Line` en el color `acid`, `CartesianGrid` y ejes en `paper-dim` (recessive, no compiten con la línea), tooltip nativo de Recharts restyleado para que el fondo/texto/fuente coincidan con `card-brutal` (fondo `surface`, texto `paper`, `font-mono`). Si `points.length === 1`, Recharts igual dibuja el punto único sin línea — está bien, no hace falta un caso especial.

**`ProgressList.tsx`** (tocado) — sigue siendo el dueño del fetch (auth check + `getWorkoutsForCurrentUser`/`getSetsForWorkout`, sin cambios ahí) y recibe la nueva prop `exercises` además de la `exerciseNames` que ya tenía. Una vez que tiene `workouts`, calcula `prs = calculatePRs(workouts)` y mantiene `selectedExerciseId` en estado (inicializado al primer PR de la lista una vez que carga, no antes). Renderiza, en orden: `PRGrid` (con `prs`, `exercises`, `onSelectExercise` actualizando el estado) → `ProgressChart` (con `progressForExercise(workouts, selectedExerciseId)`, `exercises`, el mismo `onSelectExercise`) → la lista de entrenamientos existente, intacta, usando `exerciseNames` como siempre.

**`src/pages/progreso/index.astro`** (tocado, mínimo) — hoy arma `exerciseNames: Record<string, string>` desde `getCollection('exercises')` y se lo pasa a `ProgressList`, que lo usa tal cual para las etiquetas de la lista de entrenamientos existente (`exerciseNames[s.exercise_id]`) — esa prop se deja intacta, sin tocar ese camino. Se agrega una prop nueva, `exercises: { id: string; name: string; muscle: string }[]` (mismo `getCollection('exercises')`, tomando el primer id de `muscles`), que es la que consumen `PRGrid` y `ProgressChart`.

## Manejo de errores

- **Ejercicio sin ninguna serie con peso** (ej. peso 0 registrado, o ninguno): no debería poder pasar — el formulario de `WorkoutLogger` ya exige peso ≥ 0 y al menos una serie para guardar, así que todo ejercicio en `calculatePRs` tiene al menos un peso numérico válido.
- **Usuario sin entrenamientos registrados todavía:** mismo estado vacío que `ProgressList` ya maneja ("Todavía no tienes entrenamientos registrados") — `PRGrid`/`ProgressChart` simplemente no se montan si `workouts.length === 0` (no hay PRs que calcular).
- **Sin sesión:** sin cambios — mismo gate de auth que `ProgressList` ya tiene.

## Explícitamente fuera de este corte

- 1RM estimado (solo peso máximo).
- Gráfica de volumen (solo peso máximo por sesión).
- Cualquier cálculo en el servidor/SQL — todo es agregación client-side sobre datos ya cargados.
- Notificación o resaltado especial al lograr un PR nuevo en el momento de guardar un entrenamiento (`WorkoutLogger` no cambia).
- Comparar/superponer más de un ejercicio en la misma gráfica.
- Filtrado por rango de fechas en la gráfica (siempre muestra el historial completo del ejercicio elegido).

## Testing

Igual que el resto del proyecto: sin suite automatizada. Verificación con `npm run build` (Recharts es una librería JS pura, sin problema de SSR ya que el componente se monta `client:load` como el resto de los componentes React del sitio) y smoke test manual con Playwright: con una cuenta con entrenamientos ya cargados, confirmar que la grilla de PRs muestra los ejercicios correctos con el peso correcto, que clickear una tarjeta cambia la gráfica, y que la gráfica muestra los puntos esperados para un ejercicio con múltiples sesiones.
