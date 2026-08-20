# Perfil enriquecido: nivel de entrenamiento y sexo — diseño

Ítem del backlog de negocio (`docs/roadmap-ideas.md`) con una pregunta abierta explícita: si sexo/nivel alimentan algo automático o son solo informativos. Resuelto en brainstorming: **ambos alimentan la recomendación de rutinas predefinidas de gym**, no son solo decorativos.

**Pedido:**
- Agregar nivel de entrenamiento (principiante/intermedio/avanzado) y sexo (femenino/masculino) al perfil del usuario, ambos opcionales.
- El nivel se usa para recomendar rutinas predefinidas que ya coinciden por nivel (`level` ya existe en `src/content/plans/`, pero hoy es solo texto mostrado, nada lo usa para filtrar/ordenar).
- El sexo influye en qué rutinas de **gym** se sugieren — se agregan variantes de contenido con distinto énfasis muscular (más volumen de glúteo/tren inferior vs. más volumen de empuje/espalda).

**Explícitamente fuera de esta ronda:**
- Que el entrenador vea el sexo/nivel de su alumno. Hoy un entrenador conectado **no puede leer nada** del perfil del alumno — esa capacidad se cortó a propósito durante "Rol de entrenador" (`docs/agents/rol-entrenador-status.md`) por una política de RLS que exponía la fila completa de `profiles`. Reabrir esa decisión de seguridad queda para una ronda aparte si hace falta.
- Variantes por sexo en running/natación/combate — el catálogo de esas disciplinas hoy es chico (2 actividades cada una), no da para diferenciar contenido con sentido. Solo gym tiene variantes.
- Filtro estricto u ocultamiento de rutinas no recomendadas — todas las rutinas predefinidas de gym siguen visibles y elegibles siempre, la recomendación es aditiva (etiqueta + orden), nunca restrictiva.
- Un tercer valor de sexo tipo "prefiero no decir" — no completar el campo (`NULL`) ya cumple ese rol: sin recomendación por sexo, sin bloquear nada.
- Mencionar el sexo en el nombre de las rutinas — los nombres describen el énfasis muscular ("Glúteo y pierna", "Empuje y espalda"), el campo `sex` vive solo en el frontmatter para la lógica de recomendación.

## Enfoque técnico elegido

**El campo `sex` en `plans` es aditivo, no reemplaza nada.** Las dos rutinas de gym que ya existen (`full-body.md`, `push-pull-legs.md`) quedan intactas, sin `sex` — siguen siendo la opción unisex, recomendada solo por nivel. Las 4 rutinas nuevas son variantes adicionales del mismo nivel, no reemplazos. Esto evita reducir las opciones de nadie: quien no completó sexo en su perfil, o cuyo sexo no calza con ninguna variante, sigue viendo (y pudiendo elegir) las mismas rutinas de siempre.

**La recomendación es puramente de presentación, no un filtro de datos.** `RoutineManager.tsx` sigue recibiendo la misma lista completa de `predefinedRoutines` que hoy — el cálculo de qué está "recomendada" pasa en el cliente, comparando contra el perfil ya cargado, y solo cambia el orden de render y una etiqueta. No hay query nueva a Supabase ni cambio en `src/pages/rutinas/index.astro`.

## 1. Modelo de datos

`profiles` gana dos columnas, mismo patrón que `theme` (texto + `check` en vez de un enum de Postgres, consistente con el resto del schema):

```sql
alter table profiles add column sex text check (sex in ('femenino', 'masculino'));
alter table profiles add column training_level text check (training_level in ('principiante', 'intermedio', 'avanzado'));
```

Ambas nullable, sin default — un perfil existente las tiene en `NULL` hasta que el usuario las complete. `src/types/db.ts` extiende el tipo `Profile` con `sex` y `training_level` — snake_case, igual que el resto de campos del tipo (`display_name`, `weight_kg`, etc.); no hay mapeo camelCase en ningún punto de este tipo.

`src/content.config.ts`, colección `plans`, suma un campo opcional:

```ts
sex: z.enum(['femenino', 'masculino']).optional(),
```

Se agrega a nivel del objeto `plans` (no es discriminada como `activities`), así que aplica a las 6 rutinas de gym pero queda simplemente sin definir en las de running/natación/combate.

## 2. Perfil — UI

En `ProfileForm.tsx`, dos selects nuevos junto a las medidas corporales, mismo estilo visual que el selector de tema claro/oscuro ya existente:

- **Sexo**: opciones "Femenino" / "Masculino", más un estado inicial sin seleccionar.
- **Nivel de entrenamiento**: opciones "Principiante" / "Intermedio" / "Avanzado", más un estado inicial sin seleccionar.

Se guardan con el `upsertProfile` existente extendido — no hace falta ninguna función nueva en `src/lib/profile.ts` más allá de ampliar el tipo/payload.

## 3. Lógica de recomendación en `/rutinas/`

En `RoutineManager.tsx`, al construir `predefinedOptions`, cada rutina de gym se marca `recommended: true` si:

- `plan.level` (normalizado, ej. minúsculas) coincide con `profile.trainingLevel`, cuando el usuario lo completó, **y**
- `plan.sex` es `undefined` (unisex) o coincide con `profile.sex`, cuando el usuario lo completó.

Si el usuario no completó nivel y/o sexo, esa parte de la condición se omite (no bloquea, simplemente no suma esa señal). Esta lógica se calcula **solo para las 6 rutinas de gym**; running/natación/combate quedan fuera del cálculo de recomendación por completo y mantienen su orden alfabético actual — con una sola rutina predefinida por disciplina, "recomendar" no aporta nada ahí. El componente `RoutineList` recibe la lista completa ya ordenada (gym: recomendadas primero, resto después en orden alfabético; el resto de disciplinas sin tocar) y renderiza la etiqueta "Recomendada para vos" solo en las rutinas de gym marcadas.

## 4. Contenido: 4 rutinas nuevas de gym

Mismo patrón de archivo que las existentes (`src/content/plans/*.md`), usando únicamente actividades ya presentes en `src/content/activities/`.

**Nivel Principiante** (cadence de 3 días, igual que `full-body.md`):

- **`full-body-gluteo-pierna.md`** — "Full Body — Glúteo y pierna" (`sex: femenino`). Cada día combina 2 ejercicios de glúteo/tren inferior con 1 de tren superior (empuje o jalón, alternando):
  - lunes: sentadilla goblet, hip thrust, remo con barra
  - miércoles: peso muerto rumano, abductor en máquina, press de banca
  - viernes: zancadas, puente de glúteo, jalón al pecho
- **`full-body-empuje-espalda.md`** — "Full Body — Empuje y espalda" (`sex: masculino`). Cada día combina 2 ejercicios de tren superior con 1 de pierna:
  - lunes: press de banca, remo con barra, sentadilla con barra
  - miércoles: press militar, jalón al pecho, prensa de piernas 45°
  - viernes: press inclinado con mancuernas, remo en polea baja sentado, zancadas

**Nivel Intermedio** (cadence de 4 días, igual que `push-pull-legs.md`):

- **`push-pull-legs-gluteo-pierna.md`** — "Push/Pull/Legs — Glúteo y pierna" (`sex: femenino`). Push y pull recortados a 2 ejercicios cada uno; pierna expandida; el 4º día pasa de accesorio de hombro a accesorio de glúteo:
  - lunes (push): press de banca, press militar
  - martes (pull): remo con barra, dominadas
  - jueves (pierna, expandido): sentadilla búlgara, hip thrust, prensa de piernas unilateral, curl femoral
  - viernes (glúteo, nuevo): abductor en máquina, puente de glúteo, patada de glúteo en polea
- **`push-pull-legs-empuje-espalda.md`** — "Push/Pull/Legs — Empuje y espalda" (`sex: masculino`). Push y pull expandidos a 4 ejercicios cada uno; pierna recortada; el 4º día de accesorio de hombro/espalda queda igual que el original:
  - lunes (push, expandido): press de banca, press militar, press inclinado con mancuernas, extensión de tríceps en polea
  - martes (pull, expandido): remo con barra, dominadas, jalón al pecho, curl de bíceps con mancuernas
  - jueves (pierna, recortado): sentadilla con barra, curl femoral
  - viernes (accesorio hombro/espalda): elevaciones laterales, pájaros con mancuernas, encogimientos de hombros

`goal` de las 4 rutinas nuevas sigue el mismo texto que su rutina base ("Fuerza general" para las de Principiante, "Hipertrofia" para las de Intermedio) — el énfasis está en el nombre y el contenido de los días, no en un campo nuevo.

## 5. Migraciones y verificación

- Migración SQL nueva en `supabase/schema.sql` (las dos columnas de `profiles`) — aplicada vía el flujo ya establecido del proyecto (`supabase db query --linked --file ...`), no una migración versionada separada, consistente con cómo se agregaron `theme`/`accent_color` anteriormente.
- `npm run build` + `npx tsc --noEmit` (el error preexistente de `ProgressList.tsx` es el único esperado).
- Playwright contra la cuenta de prueba real: completar sexo+nivel en Perfil y confirmar que persiste; ir a `/rutinas/` → "Elegir predefinida" y confirmar que la(s) rutina(s) de gym que coinciden muestran la etiqueta "Recomendada para vos" y aparecen primero, mientras el resto sigue visible y activable; probar también el caso sin sexo/nivel completado (perfil nuevo) y confirmar que no rompe nada ni muestra recomendaciones falsas.
