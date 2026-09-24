# Bilingüe ES/EN — Ronda 2 (contenido) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que nombres e instrucciones de los 86 ejercicios/actividades y los 9 planes, más equipamiento, nivel, grupos de natación y nombres de músculos, se vean en inglés bajo `/en/...` (español sin cambios).

**Architecture:** Campos `name_en` / `instructions_en` (actividades) y `name_en` / `goal_en` (planes) obligatorios en el schema de Zod, dentro de cada `.md`. Un helper puro `src/lib/content-i18n.ts` elige el idioma en las páginas Astro y entrega a los islands de React objetos ya traducidos. Los vocabularios repetidos (`equipment`, `planLevels`, `groups`, `muscles`) viven en el diccionario `src/i18n/{es,en}.ts`; `level` y `group` siguen siendo claves de lógica en los archivos y solo se traducen al mostrarlas.

**Tech Stack:** Astro 5 (content collections + Zod, `astro:i18n`), React 19, TypeScript. Tests con `node --test` (Node 22 ejecuta `.ts` sin imports de runtime directamente; no se agrega vitest). `js-yaml` (ya en `node_modules`) para el test de cobertura del contenido.

**Spec:** `docs/superpowers/specs/2026-09-24-bilingue-contenido-design.md`

## Convenciones de todo el plan

- **Commits:** cada commit termina con el trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` (segundo `-m`).
- **Verificación estándar** (se cita como "verificación estándar"): `npx tsc --noEmit` debe mostrar **solo** el error preexistente de `src/components/react/ProgressList/ProgressList.tsx` (`Measurement[]` no asignable, ~línea 195) y `npm run build` debe terminar con `Complete!` y 26 páginas.
- **Ejecutar en un worktree** (`bilingue-contenido`, vía `EnterWorktree`). Antes de crearlo, el fix de `ActivityPicker`/`CreateRoutineForm`/`RoutineManager` (pickerT/disciplinesT) debe estar commiteado en `main`, si no el worktree no lo tendrá.
- **Desviación del spec (YAGNI):** el cuerpo de los planes no se muestra en ninguna pantalla, así que los planes NO llevan `instructions_en` (solo `name_en` y `goal_en`). Task 0 corrige el spec.
- **Formato YAML de las traducciones:** una sola línea entre comillas dobles (`instructions_en: "..."`, generada con `JSON.stringify`, YAML válido). Reemplaza el `>-` del ejemplo del spec para poder insertar los campos con un script sin riesgo de romper la indentación.

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `docs/superpowers/specs/2026-09-24-bilingue-contenido-design.md` | Modificar | Quitar `instructions_en` de planes (Task 0) |
| `src/i18n/es.ts`, `src/i18n/en.ts` | Modificar | Namespaces `equipment`, `planLevels`, `groups`, `muscles` |
| `src/lib/muscles.ts` | Modificar | `muscleLabel(id, labels?)` |
| `src/lib/activities.ts` | Modificar | `fullActivityName` usa `groupLabel` ya traducido |
| `src/lib/content-i18n.ts` | Crear | `localizeActivity`, `localizePlan` (puros, testeables) |
| `src/components/react/MuscleBody/MuscleBody.tsx`, `MuscleExplorer/MuscleExplorer.tsx`, `ProgressList/PRGrid.tsx`, `ProgressList/ProgressList.tsx` | Modificar | Recibir labels de músculos traducidos |
| `src/components/react/ActivityPicker/ActivityPicker.tsx` | Modificar | `ActivityOption.groupLabel`; botones de grupo traducidos |
| `src/components/react/RoutineManager/RoutineManager.tsx` | Modificar | `levelLabel` en el subtítulo del plan |
| `src/content.config.ts` | Modificar | Campos `*_en` obligatorios |
| `src/content/activities/*.md` (86), `src/content/plans/*.md` (9) | Modificar | Agregar `name_en` / `instructions_en` / `goal_en` |
| `scripts/apply-content-translations.mjs` | Crear (temporal) | Inserta las traducciones aprobadas en el frontmatter |
| `docs/agents/bilingue-contenido-traducciones.json` | Crear (temporal) | Fuente única de las traducciones durante la ronda |
| `tests/muscles.test.mjs`, `tests/activities.test.mjs`, `tests/content-i18n.test.mjs`, `tests/content-coverage.test.mjs` | Crear | Tests |
| `src/pages/{ejercicios,rutinas,registro,progreso}/…` y `conexiones.astro` + espejos `src/pages/en/…` | Modificar | Usar el helper |

---

### Task 0: Corregir el spec (planes sin `instructions_en`)

**Files:**
- Modify: `docs/superpowers/specs/2026-09-24-bilingue-contenido-design.md`

- [ ] **Step 1: Editar el spec**

En la sección "Schema", cambiar la línea
`- Planes: \`name_en\`, \`goal_en\`, \`instructions_en\`, todos \`z.string()\`.`
por
`- Planes: \`name_en\` y \`goal_en\`, ambos \`z.string()\`. El cuerpo del plan no se muestra en ninguna pantalla, así que no lleva \`instructions_en\` (YAGNI).`

En "Proceso de traducción", paso 2, cambiar "`instructions_en`, `goal_en` y los mapas" por "`instructions_en` (solo actividades), `goal_en` y los mapas". En "Test de cobertura" (sección Pruebas) no hay mención de planes que corregir; en el ejemplo YAML agregar debajo del bloque una línea: "Las traducciones se guardan en una sola línea entre comillas dobles (`instructions_en: \"...\"`); el `>-` del ejemplo es ilustrativo."

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-09-24-bilingue-contenido-design.md
git commit -m "docs: spec Ronda 2 — planes sin instructions_en (no se muestra en la UI)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 1: Vocabularios en el diccionario

**Files:**
- Modify: `src/i18n/es.ts` (después del namespace `disciplines`, al final del objeto `es`)
- Modify: `src/i18n/en.ts` (después de `disciplines`, al final del objeto `en`)

- [ ] **Step 1: Agregar los namespaces a `es.ts`**

Justo antes del `};` que cierra `export const es = {`, después de `disciplines: {...},`:

```ts
  // Vocabularios del contenido (src/content). Las claves de `equipment`,
  // `planLevels` y `groups` son los valores en español tal como aparecen en
  // los .md — son la clave de búsqueda, así que NO se renombran. `muscles`
  // usa los ids de src/lib/muscles.ts, más "Otros" (bucket de prs.ts).
  equipment: {
    Banco: 'Banco',
    'Banco romano': 'Banco romano',
    Barra: 'Barra',
    'Barra de dominadas': 'Barra de dominadas',
    'Barra o mancuernas': 'Barra o mancuernas',
    Mancuerna: 'Mancuerna',
    'Mancuerna o pesa rusa': 'Mancuerna o pesa rusa',
    Mancuernas: 'Mancuernas',
    'Mancuernas o barra': 'Mancuernas o barra',
    Máquina: 'Máquina',
    'Máquina o barra': 'Máquina o barra',
    'Peso corporal': 'Peso corporal',
    'Peso corporal o disco': 'Peso corporal o disco',
    Polea: 'Polea',
  },
  planLevels: {
    Principiante: 'Principiante',
    Intermedio: 'Intermedio',
    Avanzado: 'Avanzado',
  },
  groups: {
    crol: 'Crol',
    dorso: 'Dorso',
    mariposa: 'Mariposa',
    pecho: 'Pecho',
  },
  muscles: {
    pecho: 'Pecho',
    dorsales: 'Dorsales',
    trapecio: 'Trapecio',
    'deltoide-frontal': 'Deltoide frontal',
    'deltoide-lateral': 'Deltoide lateral',
    'deltoide-posterior': 'Deltoide posterior',
    biceps: 'Bíceps',
    triceps: 'Tríceps',
    antebrazo: 'Antebrazo',
    abdomen: 'Abdomen',
    oblicuos: 'Oblicuos',
    lumbares: 'Lumbares',
    cuadriceps: 'Cuádriceps',
    isquiotibiales: 'Isquiotibiales',
    aductores: 'Aductores',
    gluteos: 'Glúteos',
    gemelos: 'Gemelos',
    Otros: 'Otros',
  },
```

- [ ] **Step 2: Agregar los mismos namespaces a `en.ts`** (mismas claves, valores en inglés)

```ts
  equipment: {
    Banco: 'Bench',
    'Banco romano': 'Roman chair',
    Barra: 'Barbell',
    'Barra de dominadas': 'Pull-up bar',
    'Barra o mancuernas': 'Barbell or dumbbells',
    Mancuerna: 'Dumbbell',
    'Mancuerna o pesa rusa': 'Dumbbell or kettlebell',
    Mancuernas: 'Dumbbells',
    'Mancuernas o barra': 'Dumbbells or barbell',
    Máquina: 'Machine',
    'Máquina o barra': 'Machine or barbell',
    'Peso corporal': 'Bodyweight',
    'Peso corporal o disco': 'Bodyweight or plate',
    Polea: 'Cable',
  },
  planLevels: {
    Principiante: 'Beginner',
    Intermedio: 'Intermediate',
    Avanzado: 'Advanced',
  },
  groups: {
    crol: 'Freestyle',
    dorso: 'Backstroke',
    mariposa: 'Butterfly',
    pecho: 'Breaststroke',
  },
  muscles: {
    pecho: 'Chest',
    dorsales: 'Lats',
    trapecio: 'Traps',
    'deltoide-frontal': 'Front delts',
    'deltoide-lateral': 'Side delts',
    'deltoide-posterior': 'Rear delts',
    biceps: 'Biceps',
    triceps: 'Triceps',
    antebrazo: 'Forearms',
    abdomen: 'Abs',
    oblicuos: 'Obliques',
    lumbares: 'Lower back',
    cuadriceps: 'Quads',
    isquiotibiales: 'Hamstrings',
    aductores: 'Adductors',
    gluteos: 'Glutes',
    gemelos: 'Calves',
    Otros: 'Others',
  },
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run build`
Expected: verificación estándar (`en: Dictionary` falla a compilar si falta alguna clave, así que cualquier omisión aparece acá).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/es.ts src/i18n/en.ts
git commit -m "feat(i18n): vocabularios equipment/planLevels/groups/muscles en el diccionario" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `muscleLabel` con labels opcionales (TDD) + script `npm test`

**Files:**
- Modify: `package.json` (scripts)
- Create: `tests/muscles.test.mjs`
- Modify: `src/lib/muscles.ts:26-28`

- [ ] **Step 1: Agregar el script de tests**

En `package.json`, dentro de `"scripts"`, agregar después de `"preview": "astro preview"` (con coma):

```json
    "preview": "astro preview",
    "test": "node --test tests/*.test.mjs"
```

- [ ] **Step 2: Escribir el test que falla**

`tests/muscles.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { muscleLabel } from '../src/lib/muscles.ts';

test('sin labels, devuelve el label en español', () => {
  assert.equal(muscleLabel('pecho'), 'Pecho');
});

test('un id desconocido se devuelve tal cual', () => {
  assert.equal(muscleLabel('Otros'), 'Otros');
});

test('con labels, usa la traducción', () => {
  assert.equal(muscleLabel('pecho', { pecho: 'Chest' }), 'Chest');
});

test('si a los labels les falta el id, cae al español y luego al id', () => {
  assert.equal(muscleLabel('gluteos', { pecho: 'Chest' }), 'Glúteos');
  assert.equal(muscleLabel('zzz', { pecho: 'Chest' }), 'zzz');
});
```

- [ ] **Step 3: Verificar que falla**

Run: `npm test`
Expected: el test "con labels, usa la traducción" FALLA (`'Pecho' !== 'Chest'`); los otros 3 pasan.

- [ ] **Step 4: Implementar**

En `src/lib/muscles.ts`, reemplazar la función `muscleLabel` (líneas 26-28) por:

```ts
export function muscleLabel(id: string, labels?: Record<string, string>): string {
  return labels?.[id] ?? MUSCLES.find((m) => m.id === id)?.label ?? id;
}
```

- [ ] **Step 5: Verificar que pasa**

Run: `npm test`
Expected: 4 tests pasan, 0 fallan.

- [ ] **Step 6: Commit**

```bash
git add package.json tests/muscles.test.mjs src/lib/muscles.ts
git commit -m "feat: muscleLabel acepta labels traducidos (+ npm test con node --test)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Labels de músculos traducidos en la UI

**Files:**
- Modify: `src/components/react/MuscleBody/MuscleBody.tsx` (props de `t`, `MuscleLabel`, `MuscleLabelAt`, `MuscleMesh`, render en `MuscleBody`)
- Modify: `src/components/react/MuscleExplorer/MuscleExplorer.tsx`
- Modify: `src/components/react/ProgressList/PRGrid.tsx`
- Modify: `src/components/react/ProgressList/ProgressList.tsx`
- Modify: `src/pages/ejercicios/index.astro`, `src/pages/en/ejercicios/index.astro`, `src/pages/progreso/index.astro`, `src/pages/en/progreso/index.astro`

Nota: no se usa un React context porque los labels viven dentro del `<Canvas>` de R3F, que no hereda contexto del árbol de React de afuera; se pasan por props.

- [ ] **Step 1: `MuscleBody.tsx`**

1. En `MuscleBodyProps`, cambiar
`t: { loading: string; webglUnsupported: string };`
por
`t: { loading: string; webglUnsupported: string; muscleLabels: Record<string, string> };`

2. Reemplazar las dos funciones de label (líneas ~515-539) por:

```tsx
function MuscleLabel({
  muscleId,
  offset,
  labels,
}: {
  muscleId: string;
  offset: number;
  labels: Record<string, string>;
}) {
  return (
    <Html position={[0, offset, 0]} center zIndexRange={[100, 0]}>
      <div className="pointer-events-none whitespace-nowrap border border-acid bg-ink px-2 py-1 font-mono text-xs uppercase tracking-[0.15em] text-acid">
        {muscleLabel(muscleId, labels)}
      </div>
    </Html>
  );
}

function MuscleLabelAt({
  muscleId,
  position,
  labels,
}: {
  muscleId: string;
  position: [number, number, number];
  labels: Record<string, string>;
}) {
  return (
    <Html position={position} center zIndexRange={[100, 0]}>
      <div className="pointer-events-none whitespace-nowrap border border-acid bg-ink px-2 py-1 font-mono text-xs uppercase tracking-[0.15em] text-acid">
        {muscleLabel(muscleId, labels)}
      </div>
    </Html>
  );
}
```

3. En `MuscleMesh`, agregar `labels` a la desestructuración y al tipo:

```tsx
function MuscleMesh({
  part,
  active,
  hovered,
  labels,
  onHover,
  onUnhover,
  onClick,
}: {
  part: MusclePartDef;
  active: boolean;
  hovered: boolean;
  labels: Record<string, string>;
  onHover: () => void;
  onUnhover: () => void;
  onClick: () => void;
}) {
```

y sus dos usos:
`{hovered && <MuscleLabel muscleId={part.muscleId} offset={h / 2 + 0.05} />}` →
`{hovered && <MuscleLabel muscleId={part.muscleId} offset={h / 2 + 0.05} labels={labels} />}`
`{hovered && <MuscleLabel muscleId={part.muscleId} offset={labelOffset(part.geometry)} />}` →
`{hovered && <MuscleLabel muscleId={part.muscleId} offset={labelOffset(part.geometry)} labels={labels} />}`

4. En el render de `MuscleBody` (líneas ~729-740): agregar `labels={t.muscleLabels}` al `<MuscleMesh ... />` (junto a `hovered=`) y cambiar
`{hoverLabel && <MuscleLabelAt muscleId={hoverLabel.muscleId} position={hoverLabel.position} />}` por
`{hoverLabel && <MuscleLabelAt muscleId={hoverLabel.muscleId} position={hoverLabel.position} labels={t.muscleLabels} />}`

- [ ] **Step 2: `MuscleExplorer.tsx`**

`Props` pasa a:

```tsx
interface Props {
  exercises: ExerciseWithMuscles[];
  t: Dictionary['ejercicios'];
  muscleLabels: Dictionary['muscles'];
}

export default function MuscleExplorer({ exercises, t, muscleLabels }: Props) {
```

`<MuscleBody ... t={{ loading: t.loading, webglUnsupported: t.webglUnsupported }} />` →
`t={{ loading: t.loading, webglUnsupported: t.webglUnsupported, muscleLabels }}`

`{selectedMuscle ? muscleLabel(selectedMuscle) : t.noMuscleSelected}` →
`{selectedMuscle ? muscleLabel(selectedMuscle, muscleLabels) : t.noMuscleSelected}`

- [ ] **Step 3: `PRGrid.tsx`**

En `Props` agregar `muscleLabels: Dictionary['muscles'];` (después de `t`); agregar `muscleLabels,` a la desestructuración de `PRGrid`; y cambiar
`{muscleLabel(group.muscleId)}` → `{muscleLabel(group.muscleId, muscleLabels)}`.

- [ ] **Step 4: `ProgressList.tsx`**

En su `Props` (línea ~37-45) agregar `musclesT: Dictionary['muscles'];`, agregar `musclesT,` a la desestructuración del componente (junto a `exerciseNames`), y en `<PRGrid ... />` (línea ~214) agregar `muscleLabels={musclesT}`.

- [ ] **Step 5: Páginas `ejercicios` (ES y EN)**

En `src/pages/ejercicios/index.astro` cambiar `const t = getDictionary(locale).ejercicios;` por

```astro
const dict = getDictionary(locale);
const t = dict.ejercicios;
```

y `<MuscleExplorer client:load exercises={exercises} t={t} />` por
`<MuscleExplorer client:load exercises={exercises} t={t} muscleLabels={dict.muscles} />`.
Mismo cambio exacto en `src/pages/en/ejercicios/index.astro`.

- [ ] **Step 6: Páginas `progreso` (ES y EN)**

Ya tienen `const dict = getDictionary(locale);`. En `<ProgressList ...>` agregar la línea `musclesT={dict.muscles}` (junto a `disciplinesT={dict.disciplines}`) en `src/pages/progreso/index.astro` y `src/pages/en/progreso/index.astro`.

- [ ] **Step 7: Verificar**

Run: verificación estándar, más `grep -rn "muscleLabel(" src/components` — cada llamada debe pasar el segundo argumento.
Expected: tsc y build según verificación estándar; el grep no muestra llamadas con un solo argumento.

- [ ] **Step 8: Commit**

```bash
git add src/components src/pages
git commit -m "feat(i18n): nombres de músculos traducidos (Explorador 3D, tooltips y PRs)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `fullActivityName` y el picker con `groupLabel` traducido (TDD)

**Files:**
- Create: `tests/activities.test.mjs`
- Modify: `src/lib/activities.ts:63-66`
- Modify: `src/components/react/ActivityPicker/ActivityPicker.tsx` (`ActivityOption`, botones de grupo)

- [ ] **Step 1: Verificar que el nombre armado no se persiste**

Run: `grep -rn "exerciseName\|activityName" src/lib/*.ts | head`
Expected: ninguna función de `src/lib` que escriba a Supabase/IndexedDB usa `exerciseName`/`activityName` (son solo estado de pantalla de `WorkoutLogger`; a la base va el `exercise_id`/`activity_id`). Si alguna lo persiste, DETENER y avisar: los nombres en inglés se guardarían en la base.

- [ ] **Step 2: Test que falla**

`tests/activities.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { fullActivityName } from '../src/lib/activities.ts';

test('sin grupo, devuelve solo el nombre', () => {
  assert.equal(fullActivityName({ name: 'Press banca' }), 'Press banca');
});

test('con grupo sin groupLabel, usa la etiqueta en español', () => {
  assert.equal(fullActivityName({ name: 'Catch-up', group: 'crol' }), 'Crol — Catch-up');
});

test('con groupLabel traducido, lo usa en lugar de la etiqueta en español', () => {
  assert.equal(
    fullActivityName({ name: 'Catch-up', group: 'crol', groupLabel: 'Freestyle' }),
    'Freestyle — Catch-up'
  );
});
```

- [ ] **Step 3: Verificar que falla**

Run: `npm test`
Expected: el tercer test FALLA (`'Crol — Catch-up' !== 'Freestyle — Catch-up'`). (Node ejecuta `activities.ts` porque su único import es `import type`.)

- [ ] **Step 4: Implementar en `activities.ts`**

Reemplazar `fullActivityName` por:

```ts
export function fullActivityName(activity: {
  name: string;
  group?: string;
  groupLabel?: string;
}): string {
  const label = activity.groupLabel ?? groupLabel(activity.group);
  return label ? `${label} — ${activity.name}` : activity.name;
}
```

- [ ] **Step 5: `ActivityPicker.tsx`**

En `ActivityOption` agregar, después de `group?: string;`:

```ts
  // Etiqueta del grupo ya traducida (la arma content-i18n en la página);
  // si falta, los consumidores caen a groupLabel(group) en español.
  groupLabel?: string;
```

Debajo de `const groups = groupsIn(byDiscipline);` agregar:

```ts
  const groupLabelFor = (g: string) =>
    activities.find((a) => a.group === g)?.groupLabel ?? groupLabel(g) ?? g;
```

y en el botón de grupo cambiar `{groupLabel(g)}` por `{groupLabelFor(g)}`.

- [ ] **Step 6: Verificar**

Run: `npm test` y luego verificación estándar.
Expected: 7 tests pasan (4 + 3); tsc/build según verificación estándar.

- [ ] **Step 7: Commit**

```bash
git add tests/activities.test.mjs src/lib/activities.ts src/components/react/ActivityPicker/ActivityPicker.tsx
git commit -m "feat(i18n): groupLabel traducido en fullActivityName y el picker de actividades" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Helper `content-i18n` (TDD)

**Files:**
- Create: `tests/content-i18n.test.mjs`
- Create: `src/lib/content-i18n.ts`

El helper es puro y no importa nada en runtime (solo tipos), así que `node --test` lo ejecuta directo. Recibe el diccionario como argumento en vez de importarlo.

- [ ] **Step 1: Test que falla**

`tests/content-i18n.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { localizeActivity, localizePlan } from '../src/lib/content-i18n.ts';

const vocab = {
  equipment: { Máquina: 'Machine', Barra: 'Barbell' },
  planLevels: { Principiante: 'Beginner' },
  groups: { crol: 'Freestyle' },
};
const vocabEs = {
  equipment: { Máquina: 'Máquina', Barra: 'Barra' },
  planLevels: { Principiante: 'Principiante' },
  groups: { crol: 'Crol' },
};

const gymEntry = {
  id: 'abductor-maquina',
  body: '  Sentado en la máquina.  \n',
  data: {
    name: 'Abductor en máquina',
    name_en: 'Machine hip abduction',
    instructions_en: 'Seated in the machine.',
    discipline: 'gym',
    metricType: 'sets',
    muscles: ['gluteos'],
    equipment: 'Máquina',
    image: 'abductor-maquina.webp',
  },
};

const swimEntry = {
  id: 'natacion-crol-catch-up',
  body: 'Nada con un brazo adelante.',
  data: {
    name: 'Catch-up',
    name_en: 'Catch-up drill',
    instructions_en: 'Swim with one arm extended.',
    discipline: 'natacion',
    metricType: 'session',
    group: 'crol',
  },
};

test('actividad en español: nombre y cuerpo originales, cuerpo sin espacios sobrantes', () => {
  const a = localizeActivity(gymEntry, 'es', vocabEs);
  assert.equal(a.name, 'Abductor en máquina');
  assert.equal(a.description, 'Sentado en la máquina.');
  assert.equal(a.equipment, 'Máquina');
});

test('actividad en inglés: name_en, instructions_en y equipamiento traducido', () => {
  const a = localizeActivity(gymEntry, 'en', vocab);
  assert.equal(a.name, 'Machine hip abduction');
  assert.equal(a.description, 'Seated in the machine.');
  assert.equal(a.equipment, 'Machine');
  assert.equal(a.image, 'abductor-maquina.webp');
  assert.deepEqual(a.muscles, ['gluteos']);
});

test('el id, la disciplina y el metricType no cambian con el idioma', () => {
  const es = localizeActivity(gymEntry, 'es', vocabEs);
  const en = localizeActivity(gymEntry, 'en', vocab);
  for (const k of ['id', 'discipline', 'metricType']) assert.equal(es[k], en[k]);
});

test('el grupo se conserva como clave y groupLabel se traduce', () => {
  const en = localizeActivity(swimEntry, 'en', vocab);
  assert.equal(en.group, 'crol');
  assert.equal(en.groupLabel, 'Freestyle');
  const es = localizeActivity(swimEntry, 'es', vocabEs);
  assert.equal(es.groupLabel, 'Crol');
});

test('una actividad sin grupo ni equipamiento no inventa labels', () => {
  const a = localizeActivity(
    { id: 'x', body: '', data: { ...swimEntry.data, group: undefined } },
    'en',
    vocab
  );
  assert.equal(a.groupLabel, undefined);
  assert.equal(a.equipment, undefined);
});

test('un equipamiento desconocido se devuelve tal cual', () => {
  const a = localizeActivity(
    { ...gymEntry, data: { ...gymEntry.data, equipment: 'Kettlebell' } },
    'en',
    vocab
  );
  assert.equal(a.equipment, 'Kettlebell');
});

const planEntry = {
  id: 'full-body',
  data: {
    name: 'Full body',
    name_en: 'Full body split',
    goal: 'Fuerza general',
    goal_en: 'General strength',
    level: 'Principiante',
    sex: 'femenino',
    days: { lunes: ['a'] },
  },
};

test('plan en español: goal original y level como clave; levelLabel en español', () => {
  const p = localizePlan(planEntry, 'es', vocabEs);
  assert.equal(p.name, 'Full body');
  assert.equal(p.goal, 'Fuerza general');
  assert.equal(p.level, 'Principiante');
  assert.equal(p.levelLabel, 'Principiante');
});

test('plan en inglés: name_en, goal_en y levelLabel traducidos, level sigue siendo la clave en español', () => {
  const p = localizePlan(planEntry, 'en', vocab);
  assert.equal(p.name, 'Full body split');
  assert.equal(p.goal, 'General strength');
  assert.equal(p.level, 'Principiante');
  assert.equal(p.levelLabel, 'Beginner');
  assert.equal(p.sex, 'femenino');
  assert.deepEqual(p.days, { lunes: ['a'] });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npm test`
Expected: FALLA con "Cannot find module ... content-i18n.ts" (o `ERR_MODULE_NOT_FOUND`).

- [ ] **Step 3: Implementar**

`src/lib/content-i18n.ts`:

```ts
import type { Dictionary } from '../i18n/es';

export type Locale = 'es' | 'en';

// Solo lo que el helper necesita del diccionario — así los tests le pasan un
// objeto chico y no hay que importar es.ts/en.ts.
type Vocab = Pick<Dictionary, 'equipment' | 'planLevels' | 'groups'>;

// Formas estructurales (no CollectionEntry) para que el helper no dependa de
// `astro:content` y se pueda ejecutar en los tests con node.
interface ActivityEntryLike {
  id: string;
  body?: string;
  data: {
    name: string;
    name_en: string;
    instructions_en: string;
    discipline: 'gym' | 'running' | 'natacion' | 'combate';
    metricType: 'sets' | 'session';
    group?: string;
    muscles?: string[];
    equipment?: string;
    image?: string;
  };
}

interface PlanEntryLike<Days> {
  id: string;
  data: {
    name: string;
    name_en: string;
    goal: string;
    goal_en: string;
    level: string;
    sex?: 'femenino' | 'masculino';
    days: Days;
  };
}

// Las claves de los vocabularios son los valores en español tal como están en
// los .md; un valor sin entrada se muestra tal cual.
function lookup(map: object, key: string): string {
  return (map as Record<string, string>)[key] ?? key;
}

export function localizeActivity(entry: ActivityEntryLike, locale: Locale, vocab: Vocab) {
  const d = entry.data;
  const en = locale === 'en';
  return {
    id: entry.id,
    name: en ? d.name_en : d.name,
    description: en ? d.instructions_en : (entry.body?.trim() ?? ''),
    discipline: d.discipline,
    metricType: d.metricType,
    group: d.group,
    groupLabel: d.group ? lookup(vocab.groups, d.group) : undefined,
    equipment: d.equipment ? lookup(vocab.equipment, d.equipment) : undefined,
    muscles: d.muscles,
    image: d.image,
  };
}

export function localizePlan<Days>(entry: PlanEntryLike<Days>, locale: Locale, vocab: Vocab) {
  const d = entry.data;
  const en = locale === 'en';
  return {
    id: entry.id,
    name: en ? d.name_en : d.name,
    goal: en ? d.goal_en : d.goal,
    // `level` queda en español a propósito: es la clave que compara
    // isRecommendedGymPlan con el nivel del perfil. `levelLabel` es solo
    // para mostrar.
    level: d.level,
    levelLabel: lookup(vocab.planLevels, d.level),
    sex: d.sex,
    days: d.days,
  };
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npm test`
Expected: 15 tests pasan (4 + 3 + 8), 0 fallan. Luego `npx tsc --noEmit` (el helper aún no se usa, no debe agregar errores).

- [ ] **Step 5: Commit**

```bash
git add tests/content-i18n.test.mjs src/lib/content-i18n.ts
git commit -m "feat(i18n): helper content-i18n para elegir idioma de actividades y planes" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Propuesta de nombres en inglés (⛔ GATE: aprobación de Pam)

**Files:**
- Create: `docs/agents/bilingue-contenido-traducciones.json`
- Create: `scripts/apply-content-translations.mjs`

Estos dos archivos son temporales: se borran en la Task 12, cuando las traducciones ya viven en los `.md`.

- [ ] **Step 1: Crear el script que aplica las traducciones**

`scripts/apply-content-translations.mjs`:

```js
// Temporal (Ronda 2 bilingüe): inserta name_en / instructions_en / goal_en en
// el frontmatter de src/content/**, a partir de
// docs/agents/bilingue-contenido-traducciones.json. Idempotente: no toca un
// campo que el archivo ya tiene. Se borra al terminar la ronda.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const data = JSON.parse(
  readFileSync(join(ROOT, 'docs/agents/bilingue-contenido-traducciones.json'), 'utf8')
);
const ORDER = ['name_en', 'instructions_en', 'goal_en'];

function apply(collection, entries) {
  const dir = join(ROOT, 'src/content', collection);
  const ids = readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3));
  const missing = ids.filter((id) => !(id in entries));
  if (missing.length) throw new Error(`${collection}: faltan traducciones para ${missing.join(', ')}`);
  const extra = Object.keys(entries).filter((id) => !ids.includes(id));
  if (extra.length) throw new Error(`${collection}: ids sin archivo: ${extra.join(', ')}`);

  for (const [id, fields] of Object.entries(entries)) {
    const path = join(dir, `${id}.md`);
    const raw = readFileSync(path, 'utf8');
    if (raw.includes('\r')) throw new Error(`${path}: usa CRLF, no soportado`);
    const lines = raw.split('\n');
    const end = lines.indexOf('---', 1);
    if (lines[0] !== '---' || end === -1) throw new Error(`${path}: sin frontmatter`);
    const front = lines.slice(1, end);
    const nameIdx = front.findIndex((l) => l.startsWith('name:'));
    if (nameIdx === -1) throw new Error(`${path}: sin name:`);

    const toInsert = [];
    for (const key of ORDER) {
      if (fields[key] === undefined) continue;
      if (front.some((l) => l.startsWith(`${key}:`))) continue;
      // JSON.stringify produce un string YAML válido entre comillas dobles.
      toInsert.push(`${key}: ${JSON.stringify(fields[key])}`);
    }
    front.splice(nameIdx + 1, 0, ...toInsert);
    writeFileSync(path, ['---', ...front, ...lines.slice(end)].join('\n'));
  }
}

apply('activities', data.activities ?? {});
apply('plans', data.plans ?? {});
console.log('OK');
```

- [ ] **Step 2: Leer el contenido y proponer los nombres**

Leer `name:` de los 86 archivos de `src/content/activities/*.md` y de los 9 de `src/content/plans/*.md`, y escribir `docs/agents/bilingue-contenido-traducciones.json` con esta forma (solo `name_en` por ahora):

```json
{
  "activities": {
    "abductor-maquina": { "name_en": "Machine hip abduction" }
  },
  "plans": {
    "full-body": { "name_en": "Full body" }
  }
}
```

Debe haber una entrada por cada archivo (el script falla si falta o sobra un id). Reglas de estilo:
- Convenciones reales de gimnasio en inglés, no traducción literal: "Press banca" → "Bench press", "Sentadilla" → "Squat", "Peso muerto" → "Deadlift", "Dominadas" → "Pull-ups", "Remo" → "Row", "Aperturas" → "Flyes".
- Sentence case ("Machine hip abduction", no "Machine Hip Abduction"), como el resto del diccionario `en.ts`.
- En natación, `name` solo contiene el ejercicio/variante (el estilo va en `group`): mantener ese criterio ("Catch-up" sigue siendo "Catch-up drill" o "Catch-up", sin repetir "Freestyle").
- Si un nombre es idéntico en ambos idiomas (ej. "Burpees"), repetirlo igual; el test de cobertura (Task 9) tendrá una allowlist para esos casos.
- Los equipos ya tienen su propio vocabulario (`equipment`, Task 1): el nombre no debe repetir "en máquina" de forma que suene distinto al equipo ("Machine hip abduction" usa "Machine" igual que `equipment.Máquina`).

- [ ] **Step 3: Imprimir la tabla para Pam**

Run:
```bash
node -e '
const d = JSON.parse(require("fs").readFileSync("docs/agents/bilingue-contenido-traducciones.json","utf8"));
const fs = require("fs");
for (const [c, dir] of [["activities","src/content/activities"],["plans","src/content/plans"]]) {
  console.log("\n## " + c);
  for (const [id, f] of Object.entries(d[c])) {
    const name = fs.readFileSync(`${dir}/${id}.md`, "utf8").match(/^name: (.*)$/m)[1];
    console.log(`${id} | ${name} | ${f.name_en}`);
  }
}'
```
Expected: 86 líneas de actividades y 9 de planes con formato `id | ES | EN`.

- [ ] **Step 4: ⛔ DETENERSE**

No continuar a la Task 7 sin la aprobación explícita de Pam. Mostrarle la tabla completa en el chat, aplicar sus correcciones editando `bilingue-contenido-traducciones.json` y volver a imprimir solo las líneas cambiadas hasta que diga que está aprobada.

- [ ] **Step 5: Commit (solo con la aprobación de Pam)**

```bash
git add scripts/apply-content-translations.mjs docs/agents/bilingue-contenido-traducciones.json
git commit -m "docs: nombres en inglés de actividades y planes aprobados + script de aplicación" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Aplicar los nombres a los `.md`

**Files:**
- Modify: `src/content/activities/*.md` (86), `src/content/plans/*.md` (9)

- [ ] **Step 1: Aplicar**

Run: `node scripts/apply-content-translations.mjs`
Expected: imprime `OK`.

- [ ] **Step 2: Verificar el resultado**

Run: `git diff --stat | tail -1` → Expected: `95 files changed, 95 insertions(+)`.
Run: `git diff src/content/activities/abductor-maquina.md` → Expected: una sola línea agregada, `+name_en: "..."`, justo debajo de `name:`.
Run: `node scripts/apply-content-translations.mjs && git diff --stat | tail -1` → Expected: `OK` y el mismo total (idempotente, no duplica).

- [ ] **Step 3: Verificación estándar**

Run: `npx tsc --noEmit && npm run build`
Expected: verificación estándar (el schema aún no exige los campos, así que Zod ignora las claves nuevas o las acepta según el modo; el build debe seguir verde).

- [ ] **Step 4: Commit**

```bash
git add src/content
git commit -m "content: name_en de las 86 actividades y los 9 planes" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Instrucciones y objetivos en inglés

**Files:**
- Modify: `docs/agents/bilingue-contenido-traducciones.json`
- Modify: `src/content/activities/*.md` (86), `src/content/plans/*.md` (9)

- [ ] **Step 1: Traducir las instrucciones de las 86 actividades y el `goal` de los 9 planes**

Leer el cuerpo de cada `src/content/activities/*.md` y el `goal:` de cada plan, y agregar al JSON existente:
- `"instructions_en"` a cada entrada de `activities`
- `"goal_en"` a cada entrada de `plans`

Reglas de estilo:
- Mismo sentido, sin agregar ni quitar pasos; 1-2 oraciones como el original.
- Imperativo en segunda persona, como el original ("Sit in the machine…", no "The user sits…").
- Usar los nombres de equipo y músculos ya definidos en Task 1 y los nombres aprobados en Task 6 para mantener consistencia ("Machine", "Glutes"; no "device", "buttocks").
- Los `goal` de plan deben coincidir con el vocabulario del nombre aprobado (ej. `"Fuerza general"` → `"General strength"`, `"Hipertrofia"` → `"Hypertrophy"`).

- [ ] **Step 2: Aplicar**

Run: `node scripts/apply-content-translations.mjs`
Expected: `OK`.

- [ ] **Step 3: Verificar**

Run: `git diff --stat | tail -1` → Expected: `95 files changed`, con 86 inserciones de `instructions_en` y 9 de `goal_en` (sin duplicar los `name_en` ya presentes).
Run: `grep -L '^instructions_en:' src/content/activities/*.md` → Expected: ninguna línea (todos la tienen).
Run: `grep -L '^goal_en:' src/content/plans/*.md` → Expected: ninguna línea.
Run: verificación estándar.

- [ ] **Step 4: Commit**

```bash
git add docs/agents/bilingue-contenido-traducciones.json src/content
git commit -m "content: instructions_en de las actividades y goal_en de los planes" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Schema obligatorio + test de cobertura (TDD)

**Files:**
- Modify: `package.json` (devDependency `js-yaml`)
- Create: `tests/content-coverage.test.mjs`
- Modify: `src/content.config.ts`

- [ ] **Step 1: Declarar la dependencia**

Run: `npm install --save-dev js-yaml`
Expected: `package.json` gana `js-yaml` en `devDependencies` (ya estaba en `node_modules` como dependencia transitiva).

- [ ] **Step 2: Escribir el test de cobertura**

`tests/content-coverage.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { es } from '../src/i18n/es.ts';
import { en } from '../src/i18n/en.ts';
import { MUSCLES } from '../src/lib/muscles.ts';

const CONTENT = new URL('../src/content/', import.meta.url).pathname;

// "<id>:<campo>" de valores que son legítimamente iguales en español e inglés
// (ej. un nombre como "Burpees"). Agregar acá solo tras confirmarlo a mano.
const SAME_OK = new Set([]);

function load(collection) {
  const dir = join(CONTENT, collection);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const raw = readFileSync(join(dir, f), 'utf8');
      const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
      assert.ok(m, `${collection}/${f}: sin frontmatter`);
      return { id: f.slice(0, -3), data: yaml.load(m[1]), body: m[2].trim() };
    });
}

const activities = load('activities');
const plans = load('plans');

function assertTranslated(id, field, en, es_) {
  assert.equal(typeof en, 'string', `${id}: falta ${field}`);
  assert.ok(en.trim().length > 0, `${id}: ${field} vacío`);
  if (!SAME_OK.has(`${id}:${field}`)) {
    assert.notEqual(en.trim(), es_.trim(), `${id}: ${field} es idéntico al español (¿sin traducir?)`);
  }
}

test('se leyó contenido de ambas colecciones', () => {
  assert.ok(activities.length > 0);
  assert.ok(plans.length > 0);
});

test('toda actividad tiene name_en e instructions_en traducidos', () => {
  for (const a of activities) {
    assertTranslated(a.id, 'name_en', a.data.name_en, a.data.name);
    assertTranslated(a.id, 'instructions_en', a.data.instructions_en, a.body);
  }
});

test('todo plan tiene name_en y goal_en traducidos', () => {
  for (const p of plans) {
    assertTranslated(p.id, 'name_en', p.data.name_en, p.data.name);
    assertTranslated(p.id, 'goal_en', p.data.goal_en, p.data.goal);
  }
});

test('todo equipment usado tiene traducción en es y en', () => {
  for (const a of activities.filter((x) => x.data.equipment)) {
    assert.ok(a.data.equipment in es.equipment, `${a.id}: equipment "${a.data.equipment}" falta en es.equipment`);
    assert.ok(a.data.equipment in en.equipment, `${a.id}: equipment "${a.data.equipment}" falta en en.equipment`);
  }
});

test('todo level de plan y group de actividad tiene traducción', () => {
  for (const p of plans) {
    assert.ok(p.data.level in en.planLevels, `${p.id}: level "${p.data.level}" falta en planLevels`);
  }
  for (const a of activities.filter((x) => x.data.group)) {
    assert.ok(a.data.group in en.groups, `${a.id}: group "${a.data.group}" falta en groups`);
  }
});

test('todos los músculos del modelo (y "Otros") tienen label en es y en', () => {
  for (const m of [...MUSCLES.map((x) => x.id), 'Otros']) {
    assert.ok(m in es.muscles, `es.muscles sin ${m}`);
    assert.ok(m in en.muscles, `en.muscles sin ${m}`);
  }
});
```

- [ ] **Step 3: Correr el test (debe pasar: el contenido ya está traducido desde Task 7/8)**

Run: `npm test`
Expected: todos pasan. Si un test marca "idéntico al español" para un valor que de verdad es igual en ambos idiomas (ej. "Burpees"), confirmarlo con Pam y agregar `'<id>:<campo>'` a `SAME_OK`; si es una traducción faltante, corregirla en el `.md`.

- [ ] **Step 4: Hacer obligatorios los campos en el schema**

En `src/content.config.ts`:

Rama `metricType: z.literal('sets')`, después de `name: z.string(),`:
```ts
      name_en: z.string().min(1),
      instructions_en: z.string().min(1),
```
Rama `metricType: z.literal('session')`, después de `name: z.string(),`:
```ts
      name_en: z.string().min(1),
      instructions_en: z.string().min(1),
```
En `plans`, después de `name: z.string(),` y después de `goal: z.string(),` respectivamente:
```ts
    name_en: z.string().min(1),
```
```ts
    goal_en: z.string().min(1),
```

- [ ] **Step 5: Verificar que el schema bloquea un contenido sin traducir**

Run: `sed -i '/^name_en:/d' src/content/activities/abductor-maquina.md && npm run build 2>&1 | tail -8; git checkout src/content/activities/abductor-maquina.md`
Expected: el build FALLA con un error de Zod señalando `name_en` de `abductor-maquina` como requerido; luego el `git checkout` restaura el archivo.
Run: verificación estándar.
Expected: tsc y build según verificación estándar.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tests/content-coverage.test.mjs src/content.config.ts
git commit -m "feat: campos *_en obligatorios en el schema + test de cobertura del contenido" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Usar el helper en las páginas (ES + EN)

**Files:**
- Modify: `src/pages/ejercicios/index.astro`, `src/pages/en/ejercicios/index.astro`
- Modify: `src/pages/rutinas/index.astro`, `src/pages/en/rutinas/index.astro`
- Modify: `src/pages/registro/nuevo.astro`, `src/pages/en/registro/nuevo.astro`
- Modify: `src/pages/progreso/index.astro`, `src/pages/en/progreso/index.astro`
- Modify: `src/pages/conexiones.astro`, `src/pages/en/conexiones.astro`

Regla de los espejos: el código debajo de los imports es idéntico entre `X` y `en/X`; en el espejo solo cambian las rutas de import (un `../` extra, ej. `'../../../lib/content-i18n'`). En cada página se agrega el import `localizeActivity`/`localizePlan` y se reemplaza el bloque que construye los datos; el bloque HTML de abajo no cambia.

- [ ] **Step 1: `ejercicios/index.astro`** (Task 3 ya definió `dict`)

Agregar `import { localizeActivity } from '../../lib/content-i18n';` y reemplazar el bloque `const activityEntries…sort(…)` por:

```astro
const activityEntries = await getCollection('activities');
const exercises = activityEntries
  .filter(isGymActivity)
  .map((e) => {
    const a = localizeActivity(e, locale, dict);
    return {
      id: a.id,
      name: a.name,
      equipment: a.equipment ?? '',
      instructions: a.description,
      muscles: a.muscles ?? [],
      image: a.image,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, locale));
```

- [ ] **Step 2: `rutinas/index.astro`**

Agregar `import { localizeActivity, localizePlan } from '../../lib/content-i18n';`. Task previa dejó `const dict = getDictionary(locale); const t = dict.rutinas;`. Reemplazar los bloques de `predefinedRoutines` y `activities` por:

```astro
const planEntries = await getCollection('plans');
const predefinedRoutines = planEntries
  .map((p) => localizePlan(p, locale, dict))
  .sort((a, b) => a.name.localeCompare(b.name, locale));

const activityEntries = await getCollection('activities');
const activities = activityEntries
  .map((e) => localizeActivity(e, locale, dict))
  .sort((a, b) => a.name.localeCompare(b.name, locale));
```

- [ ] **Step 3: `registro/nuevo.astro`**

Agregar `import { localizeActivity } from '../../lib/content-i18n';` y reemplazar el bloque `const activities = …` por:

```astro
const activityEntries = await getCollection('activities');
const activities = activityEntries
  .map((e) => localizeActivity(e, locale, dict))
  .sort((a, b) => a.name.localeCompare(b.name, locale));
```
(`plans` no cambia: solo usa `id` y `days`.)

- [ ] **Step 4: `progreso/index.astro`**

Agregar `import { localizeActivity } from '../../lib/content-i18n';` y reemplazar el bloque desde `const activityEntries` hasta el `.sort(…)` final por:

```astro
const activityEntries = await getCollection('activities');
const localized = activityEntries.map((e) => localizeActivity(e, locale, dict));

const gymActivities = activityEntries
  .filter(isGymActivity)
  .map((e) => localizeActivity(e, locale, dict));
const exerciseNames = Object.fromEntries(gymActivities.map((a) => [a.id, a.name]));
const exercises = gymActivities.map((a) => ({
  id: a.id,
  name: a.name,
  muscle: a.muscles?.[0] ?? '',
}));

const activities = localized
  .map(({ id, name, discipline, metricType, group, groupLabel }) => ({
    id,
    name,
    discipline,
    metricType,
    group,
    groupLabel,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, locale));
```
Si `isGymActivity` ya no se importa en otro lugar de la página, dejarlo (se sigue usando arriba).

- [ ] **Step 5: `conexiones.astro`**

Agregar `import { localizeActivity } from '../lib/content-i18n';` (una carpeta menos que las demás: la página está en `src/pages/`; en el espejo `src/pages/en/conexiones.astro` es `'../../lib/content-i18n'`) y reemplazar el bloque `const activities = …` por:

```astro
const activityEntries = await getCollection('activities');
const activities = activityEntries
  .map((e) => localizeActivity(e, locale, dict))
  .sort((a, b) => a.name.localeCompare(b.name, locale));
```

- [ ] **Step 6: Espejos `/en/`**

Aplicar en las 5 páginas de `src/pages/en/` los mismos reemplazos de los pasos 1-5, ajustando solo la ruta del import del helper (`../../../lib/content-i18n` para `en/x/index.astro` y `en/registro/nuevo.astro`; `../../lib/content-i18n` para `en/conexiones.astro`).

- [ ] **Step 7: Actualizar el tipo de `RoutineManager` (necesario para que compile)**

En `src/components/react/RoutineManager/RoutineManager.tsx`, en la `interface PredefinedRoutine` (línea ~55) agregar `levelLabel: string;` después de `level: string;`. (El uso en el subtítulo se cambia en la Task 11.)

- [ ] **Step 8: Verificar**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: tests pasan; tsc y build según verificación estándar. Comprobar que el HTML generado tiene inglés: `grep -o "Machine hip abduction" dist/en/ejercicios/index.html | head -1` y `grep -c "Abductor en máquina" dist/en/ejercicios/index.html`.
Expected: el primero imprime `Machine hip abduction` (ajustar al nombre aprobado en Task 6); el segundo `0`. El nombre depende de `client:load` (props serializadas en el HTML), así que debe aparecer en el markup de la isla.

- [ ] **Step 9: Commit**

```bash
git add src/pages src/components/react/RoutineManager/RoutineManager.tsx
git commit -m "feat(i18n): páginas usan content-i18n — contenido de actividades y planes en inglés" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: Nivel del plan traducido en la lista de rutinas

**Files:**
- Modify: `src/components/react/RoutineManager/RoutineManager.tsx:200`

- [ ] **Step 1: Cambiar el subtítulo**

`subtitle: \`${p.goal} · ${p.level}\`,` → `subtitle: \`${p.goal} · ${p.levelLabel}\`,`

`isRecommendedGymPlan(p, …)` sigue leyendo `p.level` (la clave en español); no tocarlo.

- [ ] **Step 2: Verificar**

Run: verificación estándar.
Run: `grep -n "levelLabel\|plan.level\|p.level" src/components/react/RoutineManager/RoutineManager.tsx`
Expected: `plan.level.toLowerCase()` en `isRecommendedGymPlan`, `levelLabel` en la interfaz y en el subtítulo, y ningún otro uso de `p.level` para mostrar texto.

- [ ] **Step 3: Commit**

```bash
git add src/components/react/RoutineManager/RoutineManager.tsx
git commit -m "feat(i18n): nivel del plan traducido en el subtítulo (la lógica de recomendadas sigue usando la clave en español)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: Verificación E2E, limpieza y documentación

**Files:**
- Delete: `scripts/apply-content-translations.mjs`, `docs/agents/bilingue-contenido-traducciones.json` (y la carpeta `scripts/` si queda vacía)
- Modify: `docs/agents/bilingue-es-en-status.md`, `docs/roadmap-ideas.md`

- [ ] **Step 1: Recorrido Playwright (verificación en vivo, obligatoria)**

Levantar `npm run build && npx astro preview` y, con la skill `webapp-testing`, recorrer y confirmar:
- **EN `/en/ejercicios/`:** nombres de ejercicios en inglés, "Equipment: Machine/Barbell…", instrucciones en inglés al expandir, y al tocar un músculo el título y el tooltip 3D en inglés ("Chest", "Glutes").
- **EN `/en/rutinas/`:** los planes predefinidos con nombre/objetivo en inglés y subtítulo "General strength · Beginner"; el picker de actividades con el nombre en inglés y, en Natación, botones de grupo "Freestyle/Backstroke/Butterfly/Breaststroke".
- **EN `/en/registro/nuevo/`:** picker y tarjetas de actividad con nombre e instrucciones en inglés; un ejercicio de natación se muestra como "Freestyle — …".
- **EN `/en/progreso/`:** historial, PRs agrupados por músculo con labels en inglés (incluido el grupo "Others" si aparece) y filtros en inglés.
- **EN `/en/conexiones/`:** vista previa de rutina compartida con nombres en inglés.
- **Regresión de recomendadas:** con un perfil con `training_level = principiante` y sexo definido, los planes marcados "Recommended" en `/en/rutinas/` coinciden con los marcados "Recomendada" en `/rutinas/`.
- **ES sin cambios:** las mismas páginas en español siguen mostrando exactamente el contenido de antes (nombres, "Equipo: Máquina", "Crol — …", músculos en español).
- **Toggle de idioma** desde `/en/ejercicios/` a `/ejercicios/` y de vuelta: el contenido cambia de idioma y no se pierde la pantalla.
- **Datos existentes:** un entrenamiento ya registrado (por id) se ve con el nombre correcto en ambos idiomas.

Reportar cada punto como pasó/falló con evidencia; cualquier falla se corrige antes de seguir.

- [ ] **Step 2: Limpiar los archivos temporales**

```bash
git rm scripts/apply-content-translations.mjs docs/agents/bilingue-contenido-traducciones.json
```
(Las traducciones ya viven en los `.md`; conservar el JSON duplicaría la fuente de verdad y se desincronizaría.)

- [ ] **Step 3: Documentar**

En `docs/agents/bilingue-es-en-status.md`: reemplazar la sección "Lo que falta — Ronda 2" por una sección "Ronda 2 — contenido (completa)" con: spec y plan (rutas), qué se construyó (campos `*_en` obligatorios, helper `content-i18n`, vocabularios `equipment`/`planLevels`/`groups`/`muscles`, `level` como clave de lógica), bugs reales encontrados durante la ejecución (si los hubo), verificación (tests, build, recorrido Playwright) y deuda pendiente. En `docs/roadmap-ideas.md`: quitar la sección "Próximo ítem sugerido: Ronda 2" y agregar una línea "**Actualizado <fecha>**: se resolvió la Ronda 2…"; en la deuda técnica del bilingüe, dejar solo lo que sigue pendiente (namespace `common`, manifest/service worker, emails de Supabase).

- [ ] **Step 4: Verificación final**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: tests pasan; verificación estándar.

- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "docs: Ronda 2 bilingüe completa — contenido traducido; se retiran los archivos temporales" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
