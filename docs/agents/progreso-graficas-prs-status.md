# Gráficas de progreso y PRs — estado

> **2026-08-15/16:** esta página se rediseñó por completo (medidas corporales,
> resumen por disciplina, PRs de cardio, filtrado). El resto de este archivo
> es la versión original (2026-08-06); ver `## Rediseño completo (2026-08-15)`
> más abajo para el estado real actual. Se deja el historial original sin
> reescribir porque sigue siendo correcto para lo que describe (la grilla de
> PRs de gym y su gráfica no cambiaron de lógica, solo de contexto alrededor).

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

## "Sugerencia de progresión automática" — RESUELTO (2026-08-15)

Ya no está pausado. Se retomó y se implementó completo, con un esquema distinto al que se estaba evaluando acá (ver por qué en "Ya decidido" abajo — la pista de "+2.5kg fijo" que quedó sin confirmar se descartó explícitamente):

- **Esquema final: autoregulado por RPE, no incremento fijo.** El usuario rechazó "+2.5kg siempre" en cuanto se lo propuse ("porque no mejor sugerimos subir de peso hasta que la tasa de esfuerzo comience a bajar mucho, tambien ese rate no tiene escala") — dos problemas con la idea original: ignoraba el esfuerzo real, y RPE no tenía ninguna referencia visible en la UI.
- Reglas implementadas en `src/lib/prs.ts` (`suggestNextSet`): sugiere subir +2.5kg solo tras **3 sesiones consecutivas con RPE < 4** (umbral bajo = "muy fácil, subí"); sugiere bajar el peso **-10%** tras **3 sesiones consecutivas con RPE ≥ 9** sin haber subido peso (estancamiento al límite → deload); en cualquier otro caso, sugiere repetir el mismo peso/reps de la última sesión.
- Se agregó una leyenda de la escala RPE (0–10, con referencias tipo "8–9 = 1–2 reps en reserva") junto a los campos de RPE en el formulario — no existía ninguna referencia antes, que era parte del problema original.
- Se muestra tanto en las tarjetas "Hoy toca" de rutina activa como en el selector libre de `WorkoutLogger`, con el motivo visible ("+2.5 kg — llevas 3 sesiones con RPE bajo", "-10% — llevas 3 sesiones al límite sin avanzar", o "igual que tu última sesión").
- `WorkoutLogger` ahora sí carga historial (`getWorkoutsForCurrentUser` + `getSetsForWorkout`), que es lo que esta nota decía que faltaba.
- Guardar un set que iguala o supera el PR previo del ejercicio resalta el mensaje de guardado con "¡Nuevo PR en X!" (ver `buildSavedMessage` en `WorkoutLogger.tsx`).

Commits: `15208c8`, `45c6906`, `ed9cc4a`.

## Rediseño completo (2026-08-15)

La página completa se repensó varias veces en la misma sesión, en pasadas sucesivas:

1. **Resumen por disciplina** (`34d6b78`) — tarjetas clickeables arriba de todo, una por disciplina que el usuario realmente practica (gym/running/natación/combate — nunca las 4 si solo entrena gym), con conteo de sesiones/series/minutos. Clickear una tarjeta filtra todo lo de abajo a esa disciplina.
2. **PRs de cardio** (`8231ea9`, `6a6ca19`, del 2026-08-06 pero recién expuestos en el rediseño) — para running/natación: distancia, tiempo y **ritmo** (`distancia / tiempo`, no al revés), calculado en `calculateCardioPRs`/`progressForCardioActivity` en `prs.ts`, con su propia gráfica (`CardioProgressChart.tsx`).
3. **Medidas corporales** (`78d1a51`) — tabla nueva `measurements` en Supabase (peso, estatura, cintura, cadera, brazo, pierna; una fila por usuario+fecha, upsert), tarjetas de resumen (`MeasurementsSummary.tsx`) con la última medida de cada campo, clickeables para ver su historial en gráfica (`MeasurementsChart.tsx`, Recharts otra vez). El recordatorio para actualizarlas está atado al vencimiento de la rutina activa (banner en `/rutinas/` y `/perfil/`), no a un cron/notificación — decisión explícita del usuario sobre las dos opciones que se le plantearon.
4. **Entrenamientos por día con etiquetas de disciplina** (`WorkoutHistory.tsx`, extraído en `976922c` junto con el resto del CRUD de rutinas/sets/sesiones, etiquetas de disciplina agregadas después en `78d1a51`) — el historial se agrupa por día, con una etiqueta de color por disciplina practicada ese día (mismo mapa de colores `DISCIPLINE_COLORS` que usa el resto de la app), y tiene edición/borrado in-place de cada set/sesión.
5. **Filtrado del historial por disciplina seleccionada** (`46c2447`, 2026-08-15 tarde) — pedido explícito del usuario después de que el resumen por disciplina ya filtraba los PRs pero no "Entrenamientos": clickear una disciplina ahora también filtra qué días se muestran abajo, no solo los PRs de arriba.

Commits (todos 2026-08-15 salvo donde se indica): `34d6b78`, `78d1a51`, `46c2447`, más `8231ea9`/`6a6ca19` (2026-08-06, expuestos recién acá).

## Lo que falta / limitaciones conocidas (actualizado 2026-08-16)

- Sin 1RM estimado (explícitamente fuera de alcance del spec original).
- Sin gráfica de volumen, solo peso máximo por sesión (gym) / ritmo por sesión (cardio).
- Sin comparar/superponer más de un ejercicio o actividad en la misma gráfica.
- Sin filtrado por rango de fechas (siempre muestra el historial completo, aunque ahora sí se puede filtrar por disciplina).
- Sin suite de tests automatizada (consistente con el resto del proyecto) — toda la verificación es manual vía Playwright contra Supabase real, ver notas de cada commit y `docs/agents/notas-de-entorno-y-lecciones.md`.
- El deload (-10%) y el progreso (+2.5kg) usan umbrales fijos sin que el usuario los pueda ajustar — no hay configuración de "qué tan agresivo" quiere el autoregulado.

## Si se retoma

- El límite real que queda es el diseño técnico del deload/progresión si algún día se quiere hacer configurable — hoy `LOW_RPE_THRESHOLD`, `HIGH_RPE_THRESHOLD`, `STREAK_REQUIRED`, `WEIGHT_INCREMENT_KG`, `DELOAD_FACTOR` son constantes en `src/lib/prs.ts`, no vienen de ningún lado editable por el usuario.
- Si se agrega volumen o 1RM, `progressForExercise`/`calculatePRs` en `src/lib/prs.ts` siguen siendo el punto de entrada natural — no hay que tocar el modelo de datos, ya se guarda todo lo necesario (`reps`, `weight`, `rpe` por set).
