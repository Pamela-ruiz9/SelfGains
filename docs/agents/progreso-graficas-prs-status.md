# Gráficas de progreso y PRs — estado

Página `/progreso/`: grilla de récords personales (peso máximo por ejercicio, agrupada por músculo) + gráfica de peso máximo por sesión a lo largo del tiempo para un ejercicio elegido, arriba del historial de entrenamientos que ya existía. Spec y plan en `docs/superpowers/specs/2026-08-06-selfgains-progreso-graficas-prs-design.md` y `docs/superpowers/plans/2026-08-06-progreso-graficas-prs.md`.

## Completado (2026-08-06)

- **PR = peso máximo levantado** (no 1RM estimado). Gráfica = peso máximo por sesión, mismo número que alimenta el PR — coinciden visualmente.
- Todo calculado del lado del cliente, sin cambios de schema ni queries nuevas: `src/lib/prs.ts` (`calculatePRs`, `progressForExercise`, `groupPRsByMuscle`) opera sobre los mismos `Workout`/`WorkoutSet` que `ProgressList` ya traía.
- `src/components/react/ProgressList/PRGrid.tsx` — grilla agrupada por músculo (orden de la taxonomía de 17 músculos), cada tarjeta clickeable.
- `src/components/react/ProgressList/ProgressChart.tsx` — primer uso de **Recharts** (dependencia nueva) en el proyecto; `LineChart` con los colores/fuente del tema existente (verde `acid`, `paper-dim` recesivo, `JetBrains Mono`), sin leyenda (una sola serie, el título ya la nombra).
- `ProgressList.tsx` reescrito como dueño del estado: calcula PRs, mantiene `selectedExerciseId` (arranca con el primer ejercicio de la grilla), monta `PRGrid` + `ProgressChart` arriba del historial existente — que quedó sin tocar.
- **Fix post-revisión final:** `groupPRsByMuscle` descartaba en silencio cualquier PR de un `exercise_id` que no estuviera en la collection de ejercicios actual (ej. un ejercicio renombrado/borrado). Si era el único ejercicio del usuario, toda la sección de PRs+gráfica desaparecía sin avisar — inconsistente con el historial de abajo, que sí tiene fallback (`?? exercise_id`). Ahora esos PRs caen en un grupo "Otros" en vez de perderse (commit `bfc5e07`).

Commits: `489ebd4`, `f0be2af`, `8f693eb`, `febc7d5`, `7ce7a69`, `bfc5e07`.

## Verificación hecha

- `npm run build` limpio en cada una de las 5 tareas de código (ejecutadas con subagentes: implementador + revisión de spec + revisión de calidad), más un fix directo post-revisión-final.
- `npm ls recharts` confirmó instalación limpia, sin conflictos de peer deps con React 19 (a diferencia del lío de `three-bvh-csg`/`three-mesh-bvh` de la feature del explorador muscular).
- Smoke test end-to-end contra Supabase real: cuenta de prueba confirmada por Admin API, logueada, se cargó una progresión de sentadilla en 3 fechas (80→85→90kg) más un segundo ejercicio (press de banca). Confirmado: la grilla muestra 90kg/fecha correcta (no 80 ni 85), agrupado bajo "Cuádriceps"; press de banca bajo "Pecho"; la gráfica arranca con el primer ejercicio de la grilla ya seleccionado (sin estado vacío); click en tarjeta y dropdown cambian la gráfica igual; la línea de sentadilla muestra 3 puntos ascendentes; el tooltip al hacer hover muestra fecha+peso correctos. Cuenta borrada al final.

## Lo que falta / limitaciones conocidas

- Sin 1RM estimado (explícitamente fuera de alcance del spec).
- Sin gráfica de volumen, solo peso máximo por sesión.
- Sin comparar/superponer más de un ejercicio en la misma gráfica.
- Sin filtrado por rango de fechas (siempre muestra el historial completo).
- Sin notificación/resaltado al lograr un PR nuevo en el momento de guardar (`WorkoutLogger` no cambia).
- Sin suite de tests automatizada (consistente con el resto del proyecto).

## Pendiente: "Sugerencia de progresión automática" — PAUSADA (2026-08-06)

Era el último ítem del roadmap original. Se empezó a brainstormear pero **se pausó antes de escribir spec o plan** — no hay artefactos de diseño, solo estas notas de lo que se alcanzó a decidir:

**Ya decidido (si se retoma, no volver a preguntar):**
- Tipo de sugerencia: más peso, mismas reps que la última vez (no 1RM, no doble progresión por reps).
- Base: la serie más pesada de la sesión **más reciente** de ese ejercicio (no el PR histórico) — coherente con progresión lineal clásica (intentás superar tu última salida, no tu mejor marca de siempre).
- Ubicación: en "Registrar entrenamiento", precargando los campos de reps/peso (editable), tanto en las tarjetas "Hoy toca" de una rutina activa como al elegir un ejercicio del formulario libre.

**Explícitamente rechazado:**
- Incremento distinto por grupo muscular (ej. +2.5kg tren superior / +5kg tren inferior) — el usuario dijo "no me gustó" la clasificación propuesta, sin especificar por qué ni proponer una alternativa. **No asumir la clasificación que yo había armado si se retoma** — la lista completa de qué músculo iba en qué grupo se descartó junto con la idea.

**Sin decidir:**
- Qué incremento usar en su lugar (la opción más simple sobre la mesa era +2.5kg fijo para todo, pero nunca se confirmó — se pausó en esa pregunta).
- Todo el diseño técnico (de dónde sale "la sesión más reciente" — WorkoutLogger hoy NO carga historial de entrenamientos pasados, solo la rutina activa; habría que sumar un fetch nuevo tipo `getWorkoutsForCurrentUser`/`getSetsForWorkout`, mismo patrón que ya usa `ProgressList`).

## Si se retoma

- Arrancar el brainstorming preguntando de nuevo por el esquema de incremento (no reusar la clasificación por músculo ya rechazada).
- Revisar `src/lib/prs.ts` antes de diseñar — `progressForExercise` ya calcula "peso máximo por fecha" para un ejercicio, es la pieza más reusable para esta feature.
