# Entrenamiento multi-disciplina — estado

La app pasó de ser "solo gym" a soportar 4 disciplinas: gym, running, natación y combate. Spec y plan original en `docs/superpowers/specs/2026-08-06-selfgains-multi-disciplina-design.md` y `docs/superpowers/plans/2026-08-06-multi-disciplina.md`. Ver también `docs/agents/rutinas-status.md` (targets por actividad, metros vs. km) y `docs/agents/progreso-graficas-prs-status.md` (PRs de cardio) para features relacionadas que se documentan ahí en vez de acá.

## Completado (2026-08-06, mergeado 2026-08-15)

**Modelo de datos**
- `src/content/exercises/` renombrada a `src/content/activities/` — colección única para gym y cardio, discriminada por `metricType: 'sets' | 'session'` (gym = series/reps/peso/rpe, cardio = duración + distancia opcional).
- Tabla nueva `workout_sessions` en Supabase (paralela a `workout_sets`, mismo patrón de RLS) para sesiones de cardio/combate.
- `src/lib/workouts.ts` — `addSession`/`getSessionsForWorkout`.

**Código**
- `src/components/react/ActivityPicker/ActivityPicker.tsx` — selector compartido por gym/cardio, usado en `WorkoutLogger`, `CreateRoutineForm` y `RoutineList`. Exporta `DISCIPLINES` (gym/running/natación/combate con su label) — el resto del código (nav, tags de disciplina en Progreso, etc.) lo importa en vez de hardcodear la lista en más de un lugar.
- `WorkoutLogger.tsx` — loguea actividades mixtas de sets y sesiones en el mismo entrenamiento del día.
- `src/lib/prs.ts` — `calculateCardioPRs`/`progressForCardioActivity`/`groupCardioPRsByDiscipline` (agregación de PRs de cardio, expuestos en `/progreso/` recién en el rediseño de 2026-08-15, ver el otro doc).
- **Fusión al branch principal (2026-08-15, commit `6470321`):** esta feature se había construido completa el 2026-08-06 en un branch/worktree separado y quedó sin mergear varias semanas — el usuario preguntó por qué "no existía" el soporte multi-disciplina cuando en realidad ya estaba hecho, solo sin fusionar. Merge sin conflictos.

Commits: `dafcb34`, `f35c07e`, `ff65124`, `74f2211`, `d3ac3f9`, `3b0ab3c`, `3d5a156`, `aac7246`, `f410258`, `8231ea9`, `6a6ca19`, merge `6470321`.

## Contenido: matriz de drills de natación (2026-08-15)

Pedido inicial: agregar variantes de crol. Se corrigió a mitad de camino porque los primeros nombres eran inventados, no drills técnicos reales — el usuario pidió específicamente drills *reales*, no inventados.

- Primera pasada (`d1e9182`): variantes de crol (pull, patada, un brazo) — **descartadas** en la siguiente pasada.
- Segunda pasada (`39b1e9d`): reemplazo completo por drills técnicos reales de crol.
- Expansión a las 4 técnicas (`ac4a2d0`): crol/dorso/mariposa/pecho × completo/brazada/patada/catch-up/etc., estructura consistente entre técnicas.
- Últimos ajustes (`3877c9c`, mismo commit que agregó las descripciones visibles): "Catch-up" agregado a mariposa/pecho (antes solo crol/dorso lo tenían), "Fingertip drag" agregado a crol.
- **Regla que se mantuvo todo el tiempo:** el pool de actividades es solo-agregar. Nunca se renombró ni se borró un ejercicio/drill ya existente de una sesión anterior — solo se ajustaron nombres de archivos/frontmatter recién creados **dentro de la misma sesión** en la que se crearon, antes de que quedaran "publicados".

## Contenido: huecos de gym (2026-08-15)

Rondas sucesivas de auditoría + relleno, cada una a partir de gaps que se iban encontrando (músculo sin suficientes ejercicios, variante de máquina faltante, etc.):

- `d10e50b` — extensión de cuádriceps, aductor en máquina, remo en polea baja sentado, pullover, sentadilla búlgara, patada de glúteo en polea, puente de glúteo.
- `cae6a05` — curl de bíceps con barra, press francés, fondos en paralelas, elevación frontal con mancuerna.
- `3877c9c` — variantes de prensa de piernas (45°, vertical, unilateral) — pedido explícito ("tampoco hay prensa en gym, y diferentes tipos").

## UX del selector de actividad (2026-08-15)

- Selector en cascada disciplina → grupo (ej. natación → crol/dorso/mariposa/pecho) → drill, en vez de una lista plana larga. Se sacaron prefijos de nombre redundantes ahora que el grupo ya da ese contexto (ej. "Crol — Brazada" pasó a mostrarse como "Brazada" dentro del grupo "Crol").
- **Bug encontrado y corregido en el mismo commit:** el orden de los botones de grupo (Crol/Dorso/Mariposa/Pecho) salía mal porque se derivaba por orden alfabético de aparición de las actividades, y "pecho" tenía drills cuyo nombre empezaba con un número ("2 patadas..."), que ordena antes que "Crol" alfabéticamente. Se corrigió con un orden canónico explícito (`KNOWN_GROUPS`) en vez de confiar en el orden de aparición.

Commit: `2fd38a9`.

## Verificación hecha

- `npm run build` limpio en cada tarea de código.
- La fusión al branch principal (2026-08-15) y todo el contenido nuevo se probaron end-to-end contra Supabase real vía Playwright (cuenta de prueba, login, elegir cada disciplina en el selector, guardar una sesión de cada tipo, confirmar que aparece en el historial) — ver `docs/agents/notas-de-entorno-y-lecciones.md` para cómo se manejan las cuentas de prueba sin exponer secretos.

## Lo que falta / limitaciones conocidas

- Combate no tiene PRs de ritmo (no aplica — solo se registra tiempo total), la página de Progreso lo indica explícitamente en vez de mostrar una sección vacía.
- Sin validación de que un `activity_id` referenciado en una rutina predefinida realmente exista en la colección de contenido (mismo gap que ya existía para gym antes de esta feature).
- El selector en cascada asume que todo grupo de natación tiene el mismo set de variantes (completo/brazada/patada/catch-up/etc.) — no hay guarda si una técnica nueva no sigue esa estructura.