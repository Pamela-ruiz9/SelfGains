# Perfil enriquecido (nivel de entrenamiento + sexo) — status

**Fecha:** 2026-08-19
**Pedido:** último ítem de "Ideas de producto abiertas" en `docs/roadmap-ideas.md`, con una pregunta abierta explícita ("¿esto alimenta algo automático o es solo informativo?"). Resuelto en brainstorming: **alimenta la recomendación de rutinas predefinidas de gym** — no es decorativo. Proceso completo: brainstorming → spec (`docs/superpowers/specs/2026-08-19-perfil-enriquecido-nivel-sexo-design.md`) → plan (`docs/superpowers/plans/2026-08-19-perfil-enriquecido-nivel-sexo.md`) → implementación con subagent-driven-development (4 tasks de código, cada uno con revisión de spec compliance y de calidad de código independientes, más un task 5 de verificación E2E).

## Qué se hizo

**Modelo de datos** (Task 1): dos columnas nuevas y nullable en `profiles`, mismo patrón que `theme` (texto + `check`, sin default):
```sql
alter table profiles add column sex text check (sex in ('femenino', 'masculino'));
alter table profiles add column training_level text check (training_level in ('principiante', 'intermedio', 'avanzado'));
```
`src/types/db.ts` extendido con `Profile.sex`/`Profile.training_level`. En `src/lib/profile.ts` se agregó un comentario de seguridad explícito: estos dos campos **nunca** se mirror-ean a `public_identities` (la tabla que un entrenador conectado puede leer) — son datos privados de perfil, siguiendo la misma lógica que ya protege las medidas corporales (ver `docs/agents/rol-entrenador-status.md`, donde se cortó justamente ese tipo de exposición por RLS de fila completa).

**Contenido** (Task 2): `src/content.config.ts` — la colección `plans` gana `sex: z.enum(['femenino', 'masculino']).optional()`, relevante solo para gym. Se agregaron 4 rutinas nuevas en `src/content/plans/`, variantes de las 2 que ya existían (que quedan intactas como opción unisex):
- `full-body-gluteo-pierna.md` / `full-body-empuje-espalda.md` (Principiante).
- `push-pull-legs-gluteo-pierna.md` / `push-pull-legs-empuje-espalda.md` (Intermedio).

Cada variante redistribuye el mismo catálogo de ejercicios de gym ya existente (más volumen de glúteo/tren inferior en un caso, más volumen de empuje/espalda en el otro) — no se agregó contenido de ejercicio nuevo.

**Perfil — UI** (Task 3): dos grupos de botones nuevos en `ProfileForm.tsx` (Sexo: Femenino/Masculino/Sin especificar; Nivel de entrenamiento: Principiante/Intermedio/Avanzado/Sin especificar), mismo patrón de guardado inmediato que el selector de tema — sin submit explícito. "Sin especificar" es la única forma de volver a `null` una vez elegido algo.

**Recomendación en `/rutinas/`** (Task 4): toda la lógica vive en el cliente (`RoutineManager.tsx`), sin queries nuevas a Supabase. Dos funciones puras:
- `isGymPlan`: una rutina predefinida se considera "de gym" si la primera actividad de su contenido que se encuentra en el catálogo tiene `discipline === 'gym'` (todas las rutinas de este proyecto son de una sola disciplina, así que "la primera que se encuentra" alcanza).
- `isRecommendedGymPlan`: un campo que el usuario **sí completó** y que contradice al plan lo descarta sin importar el otro campo; para que se recomiende hace falta que **al menos un campo coincida activamente** — un perfil vacío nunca hace que todo se vea "recomendado".

Las rutinas recomendadas se ordenan primero (sort estable, conserva el alfabético existente dentro de cada grupo) y llevan la etiqueta "Recomendada para vos". Nada se oculta ni se bloquea — todas las rutinas, recomendadas o no, siguen siendo elegibles y activables.

## Verificación

- `npm run build` + `npx tsc --noEmit` limpios en cada uno de los 4 tasks de código (único error preexistente esperado en `ProgressList.tsx`, no relacionado).
- Cada task pasó una revisión de spec compliance (comparación línea por línea contra el plan, sin confiar en el reporte del implementador) y una de calidad de código, ambas con veredicto "Ready to merge: Yes" sin issues críticos ni importantes.
- Playwright end-to-end contra la cuenta de prueba real (`crud-e2e-1786826288@gmail.com`), con `npx astro preview`:
  - Sexo/nivel se guardan y persisten tras recargar; "Sin especificar" los vuelve a `null` y también persiste.
  - Con el perfil vacío, ninguna de las 9 rutinas predefinidas (2 unisex + 4 nuevas + 3 de otras disciplinas) muestra "Recomendada para vos".
  - Con sexo=Femenino y nivel=Principiante: "Full body" (unisex) y "Full body — Glúteo y pierna" quedan marcadas y ordenadas primero; "Full body — Empuje y espalda" no se marca (sexo no coincide); ninguna rutina de Push/Pull/Legs se marca (nivel no coincide); las de running/natación/combate no se marcan y no cambian de posición.
  - Se activó una rutina no recomendada ("Running — Base") para confirmar que "Activar" sigue funcionando igual para todas, sin importar la recomendación; se desactivó después.
  - Estado de la cuenta de prueba restaurado al final (sexo/nivel vueltos a "Sin especificar", rutina activa original reactivada).

## Lo que falta / no cubierto en esta ronda

- El entrenador conectado sigue sin poder ver el sexo/nivel de su alumno — quedó explícitamente fuera de esta ronda porque implicaría reabrir la decisión de seguridad de `rol-entrenador-status.md` (RLS por fila completa). Si se pide en el futuro, hay que diseñar qué columnas específicas puede leer un entrenador, no repetir ese error.
- Running/natación/combate no tienen variantes por sexo — el catálogo de esas disciplinas es chico (2 actividades cada una en running/combate), no da para diferenciar contenido con sentido todavía.
- No hay un tercer valor de sexo tipo "prefiero no decir" — "Sin especificar" (`null`) ya cumple ese rol.
- Con el backlog de `docs/roadmap-ideas.md` ahora sin ninguna idea de producto abierta, lo que queda para retomar es puramente la lista de deuda técnica compilada ahí.
