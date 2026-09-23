# Imágenes de ejercicios — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una imagen estática a cada uno de los 52 ejercicios de gym del catálogo, mostrada en Ejercicios (explorador muscular) y Registrar (ejercicio activo), con fallback silencioso cuando falta.

**Architecture:** Un campo `image` opcional (nombre de archivo) en la variante `sets` del schema de `activities`, poblado a mano vía curación desde el dataset de dominio público `free-exercise-db`, con las imágenes preprocesadas (resize + WebP) y guardadas en `public/exercises/`. Dos componentes ya muestran la descripción de cada ejercicio (`MuscleExplorer.tsx`, `WorkoutLogger.tsx`) — ambos ganan un `<img>` condicional arriba del texto existente, mismo patrón en los dos.

**Tech Stack:** Astro 5 Content Collections (Zod schema) + React (islands) + Tailwind v4. Curación con Python 3 + Pillow (ya instalado en el entorno) para el resize/conversión a WebP.

---

## Mapa de archivos

**Plomería (código, Tasks 1-3):**
- `src/content.config.ts` — nuevo campo `image` en el schema.
- `src/pages/ejercicios/index.astro` — pasa `image` al mapear ejercicios para `MuscleExplorer`.
- `src/components/react/MuscleExplorer/MuscleExplorer.tsx` — interfaz + render de la imagen.
- `src/pages/registro/nuevo.astro` — pasa `image` al mapear actividades para `WorkoutLogger`.
- `src/components/react/ActivityPicker/ActivityPicker.tsx` — `image` en `ActivityOption`.
- `src/components/react/WorkoutLogger/WorkoutLogger.tsx` — render de la imagen en las dos tarjetas de ejercicio activo.

**Curación (contenido, Tasks 4-5):**
- `public/exercises/*.webp` — hasta 52 archivos nuevos (uno por ejercicio con match razonable).
- `docs/agents/imagenes-ejercicios-curacion.md` — reporte de curación con nivel de confianza por ejercicio.

---

### Task 1: Campo `image` en el schema

**Files:**
- Modify: `src/content.config.ts`

- [ ] **Step 1: Agregar el campo a la variante `sets` (gym) del discriminated union**

Reemplazar:

```ts
    z.object({
      metricType: z.literal('sets'),
      name: z.string(),
      discipline: z.literal('gym'),
      muscles: z.array(
        z.string().refine((id) => muscleIds.includes(id), {
          message: 'Unknown muscle id — must match an id in src/lib/muscles.ts',
        })
      ),
      equipment: z.string(),
      videoUrl: z.string().url().optional(),
    }),
```

Por:

```ts
    z.object({
      metricType: z.literal('sets'),
      name: z.string(),
      discipline: z.literal('gym'),
      muscles: z.array(
        z.string().refine((id) => muscleIds.includes(id), {
          message: 'Unknown muscle id — must match an id in src/lib/muscles.ts',
        })
      ),
      equipment: z.string(),
      // Nombre de archivo en public/exercises/ (ej. "abductor-maquina.webp"),
      // no una URL — la imagen vive en el repo, no se hotlinkea. Ver
      // docs/superpowers/specs/2026-09-23-imagenes-ejercicios-design.md.
      image: z.string().optional(),
      videoUrl: z.string().url().optional(),
    }),
```

(La variante `session` — running/natación/combate — no cambia, está fuera de alcance.)

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos (el schema no rompe ningún archivo de contenido existente porque el campo es opcional).

- [ ] **Step 3: Commit**

```bash
git add src/content.config.ts
git commit -m "feat: add optional image field to gym exercise schema"
```

---

### Task 2: Mostrar la imagen en Ejercicios (`MuscleExplorer`)

**Files:**
- Modify: `src/pages/ejercicios/index.astro`
- Modify: `src/components/react/MuscleExplorer/MuscleExplorer.tsx`

- [ ] **Step 1: Pasar `image` al mapear los ejercicios de gym**

Reemplazar:

```ts
const exercises = activityEntries
  .filter(isGymActivity)
  .map((e) => ({
    id: e.id,
    name: e.data.name,
    equipment: e.data.equipment,
    instructions: e.body?.trim() ?? '',
    muscles: e.data.muscles,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
```

Por:

```ts
const exercises = activityEntries
  .filter(isGymActivity)
  .map((e) => ({
    id: e.id,
    name: e.data.name,
    equipment: e.data.equipment,
    instructions: e.body?.trim() ?? '',
    muscles: e.data.muscles,
    image: e.data.image,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
```

- [ ] **Step 2: Agregar `image` a la interfaz `ExerciseWithMuscles`**

Reemplazar:

```tsx
export interface ExerciseWithMuscles {
  id: string;
  name: string;
  equipment: string;
  instructions: string;
  muscles: string[];
}
```

Por:

```tsx
export interface ExerciseWithMuscles {
  id: string;
  name: string;
  equipment: string;
  instructions: string;
  muscles: string[];
  image?: string;
}
```

- [ ] **Step 3: Renderizar la imagen arriba del equipo/instrucciones, dentro de la tarjeta expandida**

Reemplazar:

```tsx
                {isExpanded && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-paper-dim/20 pt-3 font-mono text-sm text-paper-dim">
                    <p>
                      <span className="text-paper-dim/70">Equipo: </span>
                      {ex.equipment}
                    </p>
                    <p>{ex.instructions}</p>
                  </div>
                )}
```

Por:

```tsx
                {isExpanded && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-paper-dim/20 pt-3 font-mono text-sm text-paper-dim">
                    {ex.image && (
                      <img
                        src={`${import.meta.env.BASE_URL}exercises/${ex.image}`}
                        alt={ex.name}
                        loading="lazy"
                        className="aspect-video w-full rounded-card object-cover"
                      />
                    )}
                    <p>
                      <span className="text-paper-dim/70">Equipo: </span>
                      {ex.equipment}
                    </p>
                    <p>{ex.instructions}</p>
                  </div>
                )}
```

- [ ] **Step 4: Verificar**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio; único error de tsc es el preexistente no relacionado de `ProgressList.tsx:183`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ejercicios/index.astro src/components/react/MuscleExplorer/MuscleExplorer.tsx
git commit -m "feat: show exercise image in MuscleExplorer expanded card"
```

---

### Task 3: Mostrar la imagen en Registrar (`WorkoutLogger`/`ActivityPicker`)

**Files:**
- Modify: `src/pages/registro/nuevo.astro`
- Modify: `src/components/react/ActivityPicker/ActivityPicker.tsx`
- Modify: `src/components/react/WorkoutLogger/WorkoutLogger.tsx`

- [ ] **Step 1: Pasar `image` al mapear todas las actividades (solo las de gym lo tienen — el resto queda `undefined`)**

Reemplazar:

```ts
const activities = activityEntries
  .map((e) => ({
    id: e.id,
    name: e.data.name,
    discipline: e.data.discipline,
    metricType: e.data.metricType,
    group: e.data.metricType === 'session' ? e.data.group : undefined,
    description: e.body?.trim() ?? '',
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
```

Por:

```ts
const activities = activityEntries
  .map((e) => ({
    id: e.id,
    name: e.data.name,
    discipline: e.data.discipline,
    metricType: e.data.metricType,
    group: e.data.metricType === 'session' ? e.data.group : undefined,
    image: e.data.metricType === 'sets' ? e.data.image : undefined,
    description: e.body?.trim() ?? '',
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
```

- [ ] **Step 2: Agregar `image` a `ActivityOption`**

Reemplazar:

```tsx
export interface ActivityOption {
  id: string;
  name: string;
  discipline: 'gym' | 'running' | 'natacion' | 'combate';
  metricType: 'sets' | 'session';
  group?: string;
  description?: string;
}
```

Por:

```tsx
export interface ActivityOption {
  id: string;
  name: string;
  discipline: 'gym' | 'running' | 'natacion' | 'combate';
  metricType: 'sets' | 'session';
  group?: string;
  description?: string;
  image?: string;
}
```

- [ ] **Step 3: Renderizar la imagen en la tarjeta de un ejercicio programado ("hoy toca" / "ese día toca")**

Reemplazar:

```tsx
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-xl text-paper">{fullActivityName(activity)}</p>
        {done && (
          <span className="shrink-0 rounded-control border border-acid px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-acid">
            ✓ Hecho
          </span>
        )}
      </div>
      {activity.description && (
        <p className="font-mono text-xs text-paper-dim">{activity.description}</p>
      )}
```

Por:

```tsx
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-xl text-paper">{fullActivityName(activity)}</p>
        {done && (
          <span className="shrink-0 rounded-control border border-acid px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-acid">
            ✓ Hecho
          </span>
        )}
      </div>
      {activity.image && (
        <img
          src={`${import.meta.env.BASE_URL}exercises/${activity.image}`}
          alt={activity.name}
          loading="lazy"
          className="aspect-video w-full rounded-card object-cover"
        />
      )}
      {activity.description && (
        <p className="font-mono text-xs text-paper-dim">{activity.description}</p>
      )}
```

- [ ] **Step 4: Renderizar la imagen en el formulario libre "Agregar otra actividad"**

Reemplazar:

```tsx
          <ActivityPicker activities={activities} onSelect={setSelectedActivity} />
          {selectedActivity?.description && (
            <p className="font-mono text-xs text-paper-dim">{selectedActivity.description}</p>
          )}
```

Por:

```tsx
          <ActivityPicker activities={activities} onSelect={setSelectedActivity} />
          {selectedActivity?.image && (
            <img
              src={`${import.meta.env.BASE_URL}exercises/${selectedActivity.image}`}
              alt={selectedActivity.name}
              loading="lazy"
              className="aspect-video w-full rounded-card object-cover"
            />
          )}
          {selectedActivity?.description && (
            <p className="font-mono text-xs text-paper-dim">{selectedActivity.description}</p>
          )}
```

- [ ] **Step 5: Verificar**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio; único error de tsc es el preexistente no relacionado de `ProgressList.tsx:183`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/registro/nuevo.astro src/components/react/ActivityPicker/ActivityPicker.tsx src/components/react/WorkoutLogger/WorkoutLogger.tsx
git commit -m "feat: show exercise image in WorkoutLogger activity cards"
```

---

### Task 4: Preparar el dataset + curar el primer lote (26 ejercicios)

Esta es una tarea de curación de contenido, no de código: buscar en un dataset externo la imagen que mejor representa cada ejercicio, no algo que se pueda escribir como un diff exacto de antemano. Seguí el proceso exactamente como está descrito — es determinista en el *cómo*, no en el *qué imagen elegís* (eso requiere criterio, ver Step 4).

**Files:**
- Create: hasta 26 archivos en `public/exercises/*.webp` (uno por ejercicio con match razonable — ver Step 4, no todos van a tener uno)
- Create: `docs/agents/imagenes-ejercicios-curacion.md` (nuevo — este task lo crea, el Task 5 lo completa)

- [ ] **Step 1: Clonar el dataset (shallow, no se commitea — vive en `/tmp`)**

Run: `git clone --depth 1 https://github.com/yuhonas/free-exercise-db /tmp/free-exercise-db`
Expected: clona correctamente. Si falla por falta de acceso a red, reportar BLOCKED — no hay alternativa sin este dataset.

- [ ] **Step 2: Verificar la licencia antes de tocar cualquier imagen — gate obligatorio**

Run: `cat /tmp/free-exercise-db/LICENSE.md`
Expected (ya verificado durante la planificación, debería seguir igual): el texto de la [Unlicense](https://unlicense.org) — dominio público, sin restricciones. Si por algún motivo el archivo cambió y ya no dice esto, parar y reportar BLOCKED con el texto exacto que encontraste — no asumas que "dice dataset abierto en el README" alcanza.

- [ ] **Step 3: Cargar el índice de ejercicios**

El índice ya está verificado — vive en `/tmp/free-exercise-db/dist/exercises.json` (876 entradas). Cada entrada tiene esta forma exacta (confirmado durante la planificación):

```json
{
  "name": "3/4 Sit-Up",
  "force": "pull",
  "level": "beginner",
  "mechanic": "compound",
  "equipment": "body only",
  "primaryMuscles": ["abdominals"],
  "secondaryMuscles": [],
  "instructions": ["..."],
  "category": "strength",
  "images": ["3_4_Sit-Up/0.jpg", "3_4_Sit-Up/1.jpg"],
  "id": "3_4_Sit-Up"
}
```

Las imágenes están en `/tmp/free-exercise-db/exercises/<images[i]>` (ej. `/tmp/free-exercise-db/exercises/3_4_Sit-Up/0.jpg`). Usá `name`/`equipment`/`primaryMuscles` para buscar cada match en el Step 4 — podés cargar el JSON completo una vez con Python y buscar por substring en `name` (traduciendo el criterio del español) o filtrando por `primaryMuscles`.

- [ ] **Step 4: Curar los primeros 26 ejercicios (orden alfabético por id)**

Para cada uno de estos 26 ejercicios (formato: `id | nombre | equipo | músculos`), buscá en el índice del dataset (por nombre/categoría/equipo/músculo — el dataset está en inglés, así que traducí el criterio de búsqueda) la entrada que mejor representa el mismo movimiento:

```
abductor-maquina | Abductor en máquina | Máquina | [gluteos]
aductor-maquina | Aductor en máquina | Máquina | [aductores]
aperturas-mancuernas | Aperturas con mancuernas | Mancuernas | [pecho]
crunch-abdominal | Crunch abdominal | Peso corporal | [abdomen]
curl-biceps-barra | Curl de bíceps con barra | Barra | [biceps, antebrazo]
curl-biceps-mancuernas | Curl de bíceps con mancuernas | Mancuernas | [biceps, antebrazo]
curl-femoral | Curl femoral | Máquina | [isquiotibiales]
curl-muneca | Curl de muñeca con barra | Barra | [antebrazo]
dominadas | Dominadas | Barra de dominadas | [dorsales, biceps, antebrazo]
elevacion-frontal-mancuerna | Elevación frontal con mancuerna | Mancuernas | [deltoide-frontal]
elevacion-gemelos-prensa | Elevación de gemelos en prensa | Máquina | [gemelos]
elevacion-gemelos-sentado | Elevación de gemelos sentado | Máquina | [gemelos]
elevacion-gemelos | Elevación de gemelos de pie | Máquina o barra | [gemelos]
elevacion-piernas-banco | Elevación de piernas acostado | Banco | [abdomen]
elevacion-piernas-colgado | Elevación de piernas colgado | Barra de dominadas | [abdomen, oblicuos]
elevaciones-laterales | Elevaciones laterales | Mancuernas | [deltoide-lateral]
encogimientos-hombros | Encogimientos de hombros | Mancuernas o barra | [trapecio]
extension-cuadriceps | Extensión de cuádriceps | Máquina | [cuadriceps]
extension-triceps-polea | Extensión de tríceps en polea | Polea | [triceps]
face-pull | Face pull | Polea | [deltoide-posterior, trapecio]
fondos-paralelas | Fondos en paralelas | Peso corporal | [triceps, pecho]
giro-ruso | Giro ruso | Peso corporal o disco | [oblicuos, abdomen]
hip-thrust | Hip thrust | Barra | [gluteos, isquiotibiales]
hiperextensiones | Hiperextensiones | Banco romano | [lumbares, isquiotibiales, gluteos]
jalon-al-pecho | Jalón al pecho | Polea | [dorsales, biceps]
pajaros-mancuernas | Pájaros con mancuernas | Mancuernas | [deltoide-posterior, trapecio]
```

Para cada uno, asigná uno de estos 3 niveles de confianza:

- **directo**: mismo ejercicio, mismo equipo (ej. "Barbell Deadlift" para "Peso muerto | Barra").
- **aproximado**: mismo movimiento/músculo principal, pero equipo o variante distinta (ej. una sentadilla con mancuerna cuando el nuestro es con barra, o un ejercicio de máquina genérico cuando el nuestro especifica una máquina particular).
- **sin match razonable**: no hay nada en el dataset que represente el mismo movimiento sin forzarlo — en este caso NO se agrega imagen a ese ejercicio, se deja `image` sin definir en su archivo `.md` (no toques el `.md` en este task de todas formas — el campo ya quedó opcional en el Task 1, con no ponerle nada alcanza).

- [ ] **Step 5: Descargar y preprocesar la imagen de cada match (directo o aproximado)**

Para cada exercise `id` con match, usá este script — el primer argumento es la ruta a `exercises/<images[0]>` dentro del dataset clonado (ej. `/tmp/free-exercise-db/exercises/Barbell_Deadlift/0.jpg` para el campo `"images": ["Barbell_Deadlift/0.jpg", ...]` de esa entrada — usá el primer elemento del array salvo que el segundo represente mejor el movimiento completo), el segundo es `public/exercises/<id>.webp` con el id de NUESTRO catálogo (no el id del dataset):

```bash
python3 -c "
from PIL import Image
import sys

src, dest = sys.argv[1], sys.argv[2]
img = Image.open(src)
if img.mode in ('RGBA', 'P'):
    img = img.convert('RGB')
w, h = img.size
max_width = 480
if w > max_width:
    new_h = int(h * (max_width / w))
    img = img.resize((max_width, new_h), Image.LANCZOS)
img.save(dest, 'WEBP', quality=80)
print(f'{dest}: {img.size}')
" "/tmp/free-exercise-db/exercises/<Nombre_Del_Dataset>/0.jpg" "public/exercises/<id>.webp"
```

Corré esto una vez por cada ejercicio con match (hasta 26 veces en este task). Confirmá que `public/exercises/<id>.webp` se creó y pesa poco (`ls -la public/exercises/`).

- [ ] **Step 6: Escribir `docs/agents/imagenes-ejercicios-curacion.md` con los 26 resultados de este lote**

Crear el archivo con este formato exacto (una fila por cada uno de los 26, en el mismo orden de la lista del Step 4):

```markdown
# Curación de imágenes de ejercicios

Fuente: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (dominio público). Ver `docs/superpowers/specs/2026-09-23-imagenes-ejercicios-design.md` para el criterio de curación completo.

| id | nombre | confianza | fuente en el dataset |
|---|---|---|---|
| abductor-maquina | Abductor en máquina | <directo/aproximado/sin match> | <nombre del ejercicio en el dataset, o "—" si sin match> |
... (una fila por cada uno de los 26 de este lote, mismo orden que el Step 4) ...
```

- [ ] **Step 7: Verificar**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio; único error de tsc es el preexistente no relacionado de `ProgressList.tsx:183`. El build no debería fallar por las imágenes nuevas (son archivos estáticos en `public/`, Astro no las procesa).

- [ ] **Step 8: Commit**

```bash
git add public/exercises/ docs/agents/imagenes-ejercicios-curacion.md
git commit -m "content: curate exercise images for first batch (26 exercises)"
```

---

### Task 5: Curar el segundo lote (26 ejercicios restantes)

Mismo proceso que el Task 4, para el resto del catálogo. El dataset ya debería estar clonado en `/tmp/free-exercise-db` del task anterior — si no está (por ejemplo, si este task corre en un entorno/sesión distinta), repetí el Step 1 y Step 2 del Task 4 primero (clonar + verificar licencia) antes de continuar.

**Files:**
- Create: hasta 26 archivos más en `public/exercises/*.webp`
- Modify: `docs/agents/imagenes-ejercicios-curacion.md` (le agregás las 26 filas de este lote a la tabla que ya existe)

- [ ] **Step 1: Curar estos 26 ejercicios, mismo criterio de 3 niveles que el Task 4**

```
patada-gluteo-polea | Patada de glúteo en polea | Polea | [gluteos, isquiotibiales]
patada-triceps-mancuerna | Patada de tríceps con mancuerna | Mancuerna | [triceps]
peso-muerto-rumano | Peso muerto rumano | Barra | [isquiotibiales, gluteos, lumbares]
peso-muerto | Peso muerto | Barra | [isquiotibiales, gluteos, dorsales, lumbares]
plancha-abdominal | Plancha abdominal | Peso corporal | [abdomen, oblicuos]
plancha-lateral | Plancha lateral | Peso corporal | [oblicuos]
prensa-piernas-45 | Prensa de piernas 45° | Máquina | [cuadriceps, gluteos]
prensa-piernas-unilateral | Prensa de piernas unilateral | Máquina | [cuadriceps, gluteos]
prensa-piernas-vertical | Prensa de piernas vertical | Máquina | [cuadriceps, gluteos]
press-arnold | Press Arnold | Mancuernas | [deltoide-frontal, deltoide-lateral, triceps]
press-banca | Press de banca | Barra | [pecho, triceps]
press-cerrado-banca | Press cerrado en banca | Barra | [triceps, pecho]
press-frances | Press francés | Barra o mancuernas | [triceps]
press-inclinado-mancuernas | Press inclinado con mancuernas | Mancuernas | [pecho, deltoide-frontal, triceps]
press-militar | Press militar | Barra | [deltoide-frontal, triceps]
press-piernas | Press de piernas | Máquina | [cuadriceps, gluteos]
puente-gluteo | Puente de glúteo | Peso corporal o disco | [gluteos, isquiotibiales]
pullover | Pullover con mancuerna | Mancuerna | [dorsales, pecho]
remo-al-menton | Remo al mentón | Barra o mancuernas | [deltoide-lateral, trapecio]
remo-barra | Remo con barra | Barra | [dorsales, trapecio, biceps, deltoide-posterior]
remo-mancuerna-un-brazo | Remo con mancuerna a un brazo | Mancuerna | [dorsales, biceps, deltoide-posterior]
remo-polea-baja-sentado | Remo en polea baja sentado | Polea | [dorsales, trapecio, biceps, deltoide-posterior]
sentadilla-bulgara | Sentadilla búlgara | Mancuernas | [cuadriceps, gluteos]
sentadilla-goblet | Sentadilla goblet | Mancuerna o pesa rusa | [cuadriceps, gluteos, aductores]
sentadilla | Sentadilla con barra | Barra | [cuadriceps, gluteos, aductores]
zancadas | Zancadas | Mancuernas | [cuadriceps, gluteos, aductores]
```

- [ ] **Step 2: Descargar y preprocesar cada match, mismo script Python del Task 4 Step 5**

- [ ] **Step 3: Agregar las 26 filas de este lote a la tabla en `docs/agents/imagenes-ejercicios-curacion.md`** (mismo formato exacto que el Task 4 Step 6, agregadas debajo de las filas ya existentes — no reescribas el archivo entero, agregá filas nuevas a la tabla)

- [ ] **Step 4: Al final del archivo, agregar una sección que liste explícitamente todos los ejercicios (de los 52 totales) que quedaron en "aproximado" o "sin match"** — esta es la parte que Pam tiene que revisar antes de dar todo por bueno:

```markdown
## Para revisar

Los siguientes ejercicios NO tienen un match directo — revisar si el match aproximado es aceptable, o si conviene buscar otra fuente para esos casos puntuales:

- <id> (<nombre>): <aproximado con "X" del dataset / sin match, sin imagen>
... (todos los que no sean "directo", de los 52 totales — repasá la tabla completa, no solo este lote)
```

- [ ] **Step 5: Verificar**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio; único error de tsc es el preexistente no relacionado de `ProgressList.tsx:183`.

- [ ] **Step 6: Commit**

```bash
git add public/exercises/ docs/agents/imagenes-ejercicios-curacion.md
git commit -m "content: curate exercise images for second batch (26 exercises), add review summary"
```

---

### Task 6: Verificación final y recorrido visual

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Build y chequeo de tipos completo**

Run: `npm run build && npx tsc --noEmit`
Expected: build limpio; único error de tsc es el preexistente no relacionado de `ProgressList.tsx:183`.

- [ ] **Step 2: Confirmar cuántos de los 52 quedaron con imagen**

Run: `ls public/exercises/*.webp | wc -l`
Expected: un número entre 1 y 52 (no necesariamente 52 — algunos pueden haber quedado "sin match razonable", eso es correcto y esperado, no un bug).

- [ ] **Step 3: Recorrido visual con Playwright contra `npx astro preview`**

Levantar el preview de producción (`npm run build && npx astro preview`) y, con una cuenta de prueba real (ver `docs/agents/notas-de-entorno-y-lecciones.md` para reactivar `crud-e2e-...@gmail.com`):

- En Ejercicios: hacer click en al menos 2 músculos distintos, expandir un ejercicio que tenga imagen (confirmar que se ve bien, sin distorsión) y uno que no tenga (confirmar que la tarjeta se ve igual que antes, sin hueco ni ícono roto).
- En Registrar: activar una rutina o agregar una actividad libre que tenga imagen, confirmar que se muestra arriba de la descripción.
- Confirmar cero errores de consola.

- [ ] **Step 4: Si algo se ve mal, volver al task correspondiente y corregir antes de continuar**

- [ ] **Step 5: Reportarle a Pam cuántos de los 52 quedaron con match directo / aproximado / sin match, señalando explícitamente la sección "Para revisar" de `docs/agents/imagenes-ejercicios-curacion.md`, antes de ofrecer las opciones de `finishing-a-development-branch`**

---

## Self-review de este plan

- **Cobertura del spec:** fuente/licencia → Task 4 Step 1-2. Formato/almacenamiento → Task 4 Step 5 (script de resize+WebP). Schema → Task 1. Dónde se muestra (los 2 lugares) → Tasks 2-3. Curación con niveles de confianza y sección de revisión → Tasks 4-5. Qué no cambia (running/natación/combate, `videoUrl`, bilingüe) → respetado, ningún task los toca. Verificación → Task 6.
- **Placeholders:** ninguno — cada task de código tiene el string exacto antes/después; los tasks de curación tienen el proceso exacto (clonar, verificar licencia, inspeccionar estructura, criterio de 3 niveles, script de preprocesamiento, formato del reporte) aunque el resultado de cada match individual se resuelve en la ejecución, como corresponde a una tarea de curación real.
- **Consistencia de tipos:** `image?: string` se define una sola vez por interfaz (`ExerciseWithMuscles` en Task 2, `ActivityOption` en Task 3) y el nombre del campo es idéntico en schema/interfaces/uso (`image`, nunca `imageUrl` ni variantes). La ruta final (`${import.meta.env.BASE_URL}exercises/${x.image}`) se arma igual en los 3 lugares donde se renderiza.
