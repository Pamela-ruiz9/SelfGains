# Bilingüe ES/EN — Ronda 2: traducción de contenido

Continuación de `2026-09-23-bilingue-es-en-design.md` (Ronda 1: infraestructura + interfaz, ya en `main`). Esta ronda traduce el **contenido**: nombres e instrucciones de actividades y planes, más los vocabularios de valores repetidos (equipamiento, nivel, grupo de natación) y los nombres de músculos.

## Decisiones tomadas en el brainstorming

- **Esquema:** campos `*_en` en el mismo archivo (no colección paralela). Obligatorios en el schema de Zod: si falta una traducción, el build falla.
- **Instrucciones en inglés:** campo `instructions_en` en el frontmatter. El cuerpo del `.md` sigue siendo el español; ningún usuario en inglés lo ve.
- **Imágenes:** se reusan las mismas de `public/exercises/*.webp`. No se toca nada de imágenes.
- **Quién traduce:** el agente traduce los 95 archivos; Pam revisa. Los nombres se aprueban primero en una lista corta (es donde el vocabulario de gimnasio importa más), después se traducen las instrucciones.
- **Músculos:** incluidos en esta ronda (los 17 labels de `src/lib/muscles.ts` seguían en español en la UI en inglés; la Ronda 1 los dejó fuera).

## Alcance

- 86 archivos en `src/content/activities/*.md`, 9 en `src/content/plans/*.md`.
- Vocabularios en el diccionario: `equipment` (14 valores), `planLevels` (Principiante, Intermedio), `groups` (crol, dorso, mariposa, pecho), `muscles` (17).
- Fuera de alcance: rutinas creadas por usuarios (nombre libre), manifest de la PWA, service worker, emails de Supabase.

## Diseño

### Schema (`src/content.config.ts`)

- Actividades (ambas ramas, `sets` y `session`): `name_en: z.string()`, `instructions_en: z.string()`.
- Planes: `name_en` y `goal_en`, ambos `z.string()`. El cuerpo del plan no se muestra en ninguna pantalla, así que no lleva `instructions_en` (YAGNI).
- `level` y `sex` no cambian. `level` es una clave de lógica (`isRecommendedGymPlan` en `RoutineManager.tsx` compara `plan.level.toLowerCase()` con el nivel del perfil), así que **no se traduce en el archivo**: se traduce al mostrarlo, con `planLevels`.
- `equipment` tampoco cambia en el archivo: el valor en español es la clave del mapa `equipment` del diccionario (14 valores repetidos; traducirlos por archivo duplicaría trabajo y permitiría inconsistencias).

Ejemplo:

```yaml
---
discipline: gym
metricType: sets
name: Abductor en máquina
name_en: Machine hip abduction
instructions_en: >-
  Seated in the machine with your legs against the inner pads, push your legs
  apart against the resistance and bring them back together with control.
muscles: [gluteos]
equipment: Máquina
image: abductor-maquina.webp
---

Sentado en la máquina con las piernas apoyadas en los cojines interiores, ...
```

Las traducciones se guardan en una sola línea entre comillas dobles (`instructions_en: "..."`); el `>-` del ejemplo es ilustrativo.

### Helper `src/lib/content-i18n.ts`

Elige el idioma en el servidor (páginas Astro). `localizeActivity(entry, locale)` y `localizePlan(entry, locale)` devuelven los mismos shapes que las páginas arman hoy (`ActivityOption`, `PredefinedRoutine`) con `name`, `description`, `goal`, `equipment` y `level` ya en el idioma pedido. Los componentes React reciben texto ya traducido; no cambian por esto.

### Etiqueta de grupo

`fullActivityName` ("Crol — Catch-up") se usa en 8 componentes. En vez de tocarlos, `ActivityOption` gana `groupLabel?: string` (ya traducido por el helper) y `fullActivityName` lo usa si existe, con fallback a `groupLabel(group)` actual. El `group` (clave: `crol`, `dorso`...) no cambia — el picker filtra por él.

### Músculos

Namespace `muscles` en el diccionario (17 labels). `muscleLabel` pasa a recibir el idioma/diccionario. Se usa en `MuscleExplorer`, `MuscleBody` y `PRGrid`; se pasa la porción del diccionario desde las páginas como con el resto.

### Páginas

Las 5 páginas que leen contenido y su espejo `/en/`: `ejercicios`, `rutinas`, `registro/nuevo`, `progreso`, `conexiones` → usan el helper con su `locale`. También cualquier otra página que consuma los labels de músculos.

### Sin cambios

Ids de archivo, `muscles`, `image`, `videoUrl`, base de datos. El historial y las rutinas guardadas de los usuarios siguen funcionando (referencian ids).

## Proceso de traducción

1. El agente traduce los `name_en` de las 86 actividades y los 9 planes y entrega la lista corta a Pam para aprobar.
2. Con los nombres aprobados: `instructions_en` (solo actividades), `goal_en` y los mapas del diccionario (`equipment`, `planLevels`, `groups`, `muscles`).
3. Pam revisa el resultado completo al final.

## Pruebas

- `npm run build` y `npx tsc --noEmit` (el schema obligatorio hace que una traducción faltante rompa el build; `Dictionary` tipa `en.ts` contra `es.ts`).
- Test que recorre `src/content` y verifica que ningún `name_en`/`instructions_en`/`goal_en` esté vacío ni sea idéntico al español, con una lista corta de excepciones legítimas (nombres iguales en ambos idiomas, ej. "Burpees").
- Recorrido Playwright de las páginas `/en/` afectadas: ejercicios, rutinas (nivel y equipamiento traducidos, "recomendadas" siguen funcionando), registrar, progreso, explorador muscular; y verificación de que las páginas en español no cambiaron.
- Revisión final del contenido por Pam.

## Riesgos

- **Vocabulario de fitness:** traducciones literales incorrectas ("Press banca" ≠ "Press bench"). Mitigado por la aprobación de nombres antes de traducir el resto.
- **Regresión en "recomendadas":** si `level` se tradujera en el archivo se rompería `isRecommendedGymPlan`; el diseño lo evita dejando `level` como clave.
