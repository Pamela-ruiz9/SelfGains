# Dashboard de Progreso, gráficas legibles, rutinas con bullets e imagen al crear — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redirigir a Progreso cuando hay sesión activa, convertir Progreso en un dashboard con franja de resumen (ring de adherencia + tiles, incluido %grasa corporal), simplificar el gráfico de progreso de ejercicios (pills de una sola métrica en vez de doble eje, con tooltips explicativos y embellecidos visuales), y arreglar dos problemas de legibilidad en Rutinas (texto de rutina en bullets por día, imagen del ejercicio al crearla).

**Architecture:** Todo dentro del sitio estático Astro+React existente — sin infraestructura nueva. Un componente pequeño nuevo (`ProgressSummaryStrip`) y un módulo puro nuevo (`bodyComposition.ts`, con tests). El resto son cambios acotados a componentes/páginas que ya existen, reusando helpers ya presentes (`weekAdherence`, `RoutinePreview`, el bloque de imagen que ya existe en `WorkoutLogger`).

**Tech Stack:** Astro 5, React (islands), Recharts, Supabase JS, TypeScript, Tailwind. Sin suite de tests automatizada excepto `node --test tests/*.test.mjs` (Node 22, sin vitest) para módulos puros — se le suma un archivo de test nuevo para `bodyComposition.ts`.

**Spec:** `docs/superpowers/specs/2026-09-26-progreso-dashboard-y-fitbit-design.md` (secciones 1-5; la sección 6, Fitbit, tiene su propio plan separado: `docs/superpowers/plans/2026-09-26-fitbit-integracion.md`).

---

## Antes de empezar

Ejecutar en un worktree aislado (`superpowers:using-git-worktrees`), rama sugerida `progreso-dashboard-ux`. Todos los comandos de verificación (`npm run build`, `npx tsc --noEmit`, `npm test`) se corren desde la raíz del worktree.

---

### Task 1: Redirigir a Progreso cuando hay sesión activa

**Files:**
- Modify: `src/layouts/BaseLayout.astro:1-16` (frontmatter) y `:36` (antes del primer `<script is:inline>` existente)

- [ ] **Step 1: Agregar `supabaseUrl` al frontmatter**

En `src/layouts/BaseLayout.astro`, después de la línea `const base = import.meta.env.BASE_URL;`:

```astro
const base = import.meta.env.BASE_URL;
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
```

- [ ] **Step 2: Agregar el script de redirect, como el primer `<script>` del `<head>`**

Insertar esto inmediatamente después de la línea `<title>{title} · SelfGains</title>` y **antes** del `<script is:inline define:vars={{ base }}>` que ya existe (el del redirect de idioma) — este nuevo script debe correr primero: si hay sesión, la decisión de "ir a Progreso" pisa cualquier corrección de idioma que pudiera intentar el script siguiente sobre la home (que de todas formas se vuelve a evaluar solo al cargar Progreso).

```astro
    <script is:inline define:vars={{ base, supabaseUrl }}>
      (function () {
        // Solo actúa en la home ("/" o "/en/") — cualquier otra pantalla no
        // se toca. Heurística rápida sobre localStorage, no la verificación
        // real de sesión (esa la sigue haciendo ProgressList con
        // supabase.auth.getSession() al cargar Progreso) — si el token está
        // vencido y no se puede refrescar, el usuario simplemente ve el
        // estado "no has iniciado sesión" que Progreso ya maneja.
        // Ver docs/superpowers/specs/2026-09-26-progreso-dashboard-y-fitbit-design.md sección 1.
        var path = window.location.pathname;
        var isSpanishHome = path === base;
        var isEnglishHome = path === base + 'en/';
        if (!isSpanishHome && !isEnglishHome) return;
        try {
          var ref = supabaseUrl.replace('https://', '').split('.')[0];
          var raw = localStorage.getItem('sb-' + ref + '-auth-token');
          if (!raw) return;
          var session = JSON.parse(raw);
          if (!session || !session.access_token) return;
          window.location.replace(isEnglishHome ? base + 'en/progreso/' : base + 'progreso/');
        } catch (e) {}
      })();
    </script>
```

- [ ] **Step 3: Build y chequeo de tipos**

Run: `npm run build && npx tsc --noEmit`
Expected: build exitoso (26 páginas), único error preexistente de `ProgressList.tsx` (`Measurement[]`), nada nuevo.

- [ ] **Step 4: Verificación manual con Playwright contra `astro preview`**

Con la cuenta de prueba real logueada: navegar a `/SelfGains/` y confirmar que redirige de inmediato a `/SelfGains/progreso/` sin mostrar la landing ni un flash. Cerrar sesión y confirmar que `/SelfGains/` muestra la landing normal con los botones de registro. Repetir ambos casos en `/SelfGains/en/`.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "feat(progreso): redirigir a Progreso desde la home cuando hay sesión activa"
```

---

### Task 2: Migración — agregar `neck_cm` a `measurements` y `profiles`

**Files:**
- Modify: `supabase/schema.sql` (agregar al final)
- Create (temporal, se borra en el último step): un archivo `.sql` en el worktree para correr contra la base real

- [ ] **Step 1: Agregar las columnas a `supabase/schema.sql`**

Al final del archivo (mismo patrón que la columna `locale` de `profiles`, línea 546):

```sql
-- Circunferencia de cuello — habilita el cálculo de %grasa corporal
-- (método Navy) en docs/superpowers/specs/2026-09-26-progreso-dashboard-y-fitbit-design.md
-- sección 2.1. Opcional, como el resto de las circunferencias.
alter table measurements add column neck_cm numeric;
alter table profiles add column neck_cm numeric;
```

- [ ] **Step 2: Correr la migración contra la base real**

El CLI de Supabase ya está logueado y linkeado a este proyecto (`supabase projects list` lo confirma). Escribir el SQL a un archivo temporal y correrlo con `--file` (no inline — evita el falso positivo del clasificador de auto-mode sobre SQL con texto sensible, aunque acá no haya contraseñas):

```bash
cat > /tmp/neck-cm-migration.sql <<'EOF'
alter table measurements add column neck_cm numeric;
alter table profiles add column neck_cm numeric;
EOF
supabase db query --linked --file /tmp/neck-cm-migration.sql
rm /tmp/neck-cm-migration.sql
```

Expected: sin errores. Si el CLI no tiene el comando `db query` en esta versión, usar `supabase db execute --linked --file /tmp/neck-cm-migration.sql` (el nombre exacto del subcomando puede variar entre versiones — correr `supabase db --help` para confirmar cuál existe antes de este step si el primero falla).

- [ ] **Step 3: Confirmar que las columnas existen**

```bash
cat > /tmp/verify-neck-cm.sql <<'EOF'
select column_name from information_schema.columns
where table_name in ('measurements', 'profiles') and column_name = 'neck_cm';
EOF
supabase db query --linked --file /tmp/verify-neck-cm.sql
rm /tmp/verify-neck-cm.sql
```

Expected: dos filas (`measurements.neck_cm`, `profiles.neck_cm`).

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(db): agregar neck_cm a measurements y profiles"
```

---

### Task 3: `bodyComposition.ts` — %grasa (método Navy) y masa magra estimada

**Files:**
- Create: `src/lib/bodyComposition.ts`
- Test: `tests/body-composition.test.mjs`

- [ ] **Step 1: Escribir el test (falla primero)**

```js
// tests/body-composition.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateBodyFatPercent, estimateLeanMassKg } from '../src/lib/bodyComposition.ts';

test('estimateBodyFatPercent: hombre, datos completos', () => {
  const pct = estimateBodyFatPercent({
    sex: 'masculino',
    neckCm: 38,
    waistCm: 85,
    hipCm: null,
    heightCm: 178,
  });
  assert.ok(pct !== null);
  assert.ok(pct > 10 && pct < 25, `esperaba un % plausible, salió ${pct}`);
});

test('estimateBodyFatPercent: mujer, datos completos (usa cadera)', () => {
  const pct = estimateBodyFatPercent({
    sex: 'femenino',
    neckCm: 32,
    waistCm: 75,
    hipCm: 98,
    heightCm: 165,
  });
  assert.ok(pct !== null);
  assert.ok(pct > 10 && pct < 35, `esperaba un % plausible, salió ${pct}`);
});

test('estimateBodyFatPercent: mujer sin cadera devuelve null (falta un dato requerido)', () => {
  const pct = estimateBodyFatPercent({
    sex: 'femenino',
    neckCm: 32,
    waistCm: 75,
    hipCm: null,
    heightCm: 165,
  });
  assert.equal(pct, null);
});

test('estimateBodyFatPercent: sin sexo definido devuelve null', () => {
  const pct = estimateBodyFatPercent({
    sex: null,
    neckCm: 38,
    waistCm: 85,
    hipCm: null,
    heightCm: 178,
  });
  assert.equal(pct, null);
});

test('estimateBodyFatPercent: falta cuello devuelve null', () => {
  const pct = estimateBodyFatPercent({
    sex: 'masculino',
    neckCm: null,
    waistCm: 85,
    hipCm: null,
    heightCm: 178,
  });
  assert.equal(pct, null);
});

test('estimateLeanMassKg: peso × (1 − %grasa/100)', () => {
  assert.equal(estimateLeanMassKg(80, 20), 64);
  assert.equal(estimateLeanMassKg(60, 25), 45);
});

test('estimateLeanMassKg: %grasa null devuelve null', () => {
  assert.equal(estimateLeanMassKg(80, null), null);
});
```

- [ ] **Step 2: Confirmar que falla**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/lib/bodyComposition.ts'`.

- [ ] **Step 3: Implementar `src/lib/bodyComposition.ts`**

```ts
export interface BodyCompositionInput {
  sex: 'femenino' | 'masculino' | null;
  neckCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  heightCm: number | null;
}

// Método Navy (US Navy circumference method). Requiere cuello+cintura+altura
// siempre, y además cadera si es mujer. Si falta cualquier dato requerido,
// devuelve null en vez de inventar un número — ver
// docs/superpowers/specs/2026-09-26-progreso-dashboard-y-fitbit-design.md
// sección 2.1 sobre por qué se descartaron fórmulas menos confiables
// (BMI+edad) para esto.
export function estimateBodyFatPercent(input: BodyCompositionInput): number | null {
  const { sex, neckCm, waistCm, hipCm, heightCm } = input;
  if (!sex || neckCm === null || waistCm === null || heightCm === null) return null;
  if (waistCm <= neckCm) return null; // circunferencias no fisiológicas — no calcular

  if (sex === 'masculino') {
    const pct =
      495 /
        (1.0324 -
          0.19077 * Math.log10(waistCm - neckCm) +
          0.15456 * Math.log10(heightCm)) -
      450;
    return Math.round(pct * 10) / 10;
  }

  if (hipCm === null) return null;
  if (waistCm + hipCm <= neckCm) return null;
  const pct =
    495 /
      (1.29579 -
        0.35004 * Math.log10(waistCm + hipCm - neckCm) +
        0.221 * Math.log10(heightCm)) -
    450;
  return Math.round(pct * 10) / 10;
}

// Sustituto de "% músculo" (no existe fórmula confiable por circunferencias
// sin bioimpedancia/DEXA): masa magra en kg = peso × (1 − %grasa/100).
// Incluye músculo + hueso + órganos, no es "% músculo puro".
export function estimateLeanMassKg(weightKg: number, bodyFatPercent: number | null): number | null {
  if (bodyFatPercent === null) return null;
  return Math.round(weightKg * (1 - bodyFatPercent / 100) * 10) / 10;
}
```

- [ ] **Step 4: Confirmar que pasa**

Run: `npm test`
Expected: PASS, 7/7 tests nuevos (más los que ya existían).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bodyComposition.ts tests/body-composition.test.mjs
git commit -m "feat(progreso): calcular %grasa (método Navy) y masa magra estimada"
```

---

### Task 4: Campo "cuello" en Medidas (Perfil) + i18n

**Files:**
- Modify: `src/types/db.ts:53-83` (interfaces `Measurement` y `Profile`)
- Modify: `src/components/react/Profile/ProfileForm.tsx:26-33`
- Modify: `src/i18n/es.ts` y `src/i18n/en.ts` (namespace `perfil.measurements`)

- [ ] **Step 1: Agregar `neck_cm` a los tipos**

En `src/types/db.ts`, dentro de `Measurement` (después de `hip_cm`) y de `Profile` (después de `hip_cm`):

```ts
  hip_cm: number | null;
  neck_cm: number | null;
  arm_cm: number | null;
```

(Aplicar el mismo cambio en ambas interfaces — quedan dos ediciones idénticas en puntos distintos del archivo.)

- [ ] **Step 2: Agregar la traducción**

En `src/i18n/es.ts`, dentro de `perfil.measurements` (después de `hip: 'Cadera (cm)',`):

```ts
      hip: 'Cadera (cm)',
      neck: 'Cuello (cm)',
      arm: 'Brazo (cm)',
```

En `src/i18n/en.ts`, mismo lugar:

```ts
      hip: 'Hips (cm)',
      neck: 'Neck (cm)',
      arm: 'Arm (cm)',
```

- [ ] **Step 3: Agregar el campo al formulario**

En `src/components/react/Profile/ProfileForm.tsx`, dentro de `MEASUREMENT_FIELDS` (después de la entrada de `hip_cm`):

```ts
    { key: 'hip_cm', label: t.measurements.hip },
    { key: 'neck_cm', label: t.measurements.neck },
    { key: 'arm_cm', label: t.measurements.arm },
```

Y en el bloque que precarga `measurements` desde el perfil (cerca de la línea 112-116, junto a `hip_cm: profile.hip_cm?.toString() ?? '',`):

```ts
          hip_cm: profile.hip_cm?.toString() ?? '',
          neck_cm: profile.neck_cm?.toString() ?? '',
          arm_cm: profile.arm_cm?.toString() ?? '',
```

No hace falta tocar `handleSubmit` — ya itera genéricamente sobre `MEASUREMENT_FIELDS` y llama tanto a `upsertProfile` como a `logMeasurement` con el mismo objeto `parsed`.

- [ ] **Step 4: Build y chequeo de tipos**

Run: `npm run build && npx tsc --noEmit`
Expected: limpio (mismo único error preexistente de siempre).

- [ ] **Step 5: Verificación manual**

Contra `astro preview` con la cuenta de prueba: en Perfil, cargar un valor de "Cuello (cm)", guardar, refrescar la página y confirmar que el valor persiste (viene de `profiles.neck_cm` al recargar el formulario).

- [ ] **Step 6: Commit**

```bash
git add src/types/db.ts src/components/react/Profile/ProfileForm.tsx src/i18n/es.ts src/i18n/en.ts
git commit -m "feat(perfil): agregar circunferencia de cuello a Medidas"
```

---

### Task 5: Mostrar %grasa y masa magra en Medidas

**Files:**
- Modify: `src/components/react/ProgressList/MeasurementsSummary.tsx`
- Modify: `src/components/react/ProgressList/ProgressList.tsx`
- Modify: `src/i18n/es.ts` y `src/i18n/en.ts` (namespace `progreso.measurementsSummary`)

- [ ] **Step 1: Agregar las traducciones nuevas**

En `src/i18n/es.ts`, dentro de `progreso.measurementsSummary.fields` (después de `hip: 'Cadera',`):

```ts
      fields: {
        weight: 'Peso',
        waist: 'Cintura',
        hip: 'Cadera',
        neck: 'Cuello',
        bodyFat: '% grasa',
        leanMass: 'Masa magra',
        arm: 'Brazo',
        leg: 'Pierna',
      },
```

En `src/i18n/en.ts`, mismo lugar:

```ts
      fields: {
        weight: 'Weight',
        waist: 'Waist',
        hip: 'Hips',
        neck: 'Neck',
        bodyFat: '% body fat',
        leanMass: 'Lean mass',
        arm: 'Arm',
        leg: 'Leg',
      },
```

Nota: esta es `progreso.measurementsSummary.fields` (las etiquetas cortas para las tarjetas de Progreso — "Cuello", sin unidad), distinta de `perfil.measurements` del Task 4 ("Cuello (cm)", con unidad, para el formulario). Son dos namespaces separados a propósito, mismo patrón que ya existe para `weight`/`waist`/etc.

- [ ] **Step 2: Extender `MeasurementsSummary.tsx` con dos entradas derivadas**

`%grasa` y `masa magra` no son columnas de `Measurement` — se calculan a partir de otras. `MEASUREMENT_DISPLAY_FIELDS` (que hoy es solo `key: keyof Measurement`) no les sirve tal cual; se agrega una lista paralela de "campos derivados" que el componente calcula antes de mostrarlos:

```tsx
import type { Measurement } from '../../../types/db';
import type { Dictionary } from '../../../i18n/es';
import { estimateBodyFatPercent, estimateLeanMassKg } from '../../../lib/bodyComposition';

type MeasurementFieldLabelKey = keyof Dictionary['progreso']['measurementsSummary']['fields'];

export const MEASUREMENT_DISPLAY_FIELDS: {
  key: keyof Measurement;
  labelKey: MeasurementFieldLabelKey;
  unit: string;
}[] = [
  { key: 'weight_kg', labelKey: 'weight', unit: 'kg' },
  { key: 'waist_cm', labelKey: 'waist', unit: 'cm' },
  { key: 'hip_cm', labelKey: 'hip', unit: 'cm' },
  { key: 'neck_cm', labelKey: 'neck', unit: 'cm' },
  { key: 'arm_cm', labelKey: 'arm', unit: 'cm' },
  { key: 'leg_cm', labelKey: 'leg', unit: 'cm' },
];

interface Props {
  latest: Measurement | null;
  sex: 'femenino' | 'masculino' | null;
  selected: string | null;
  onSelect: (key: string | null) => void;
  t: Dictionary['progreso']['measurementsSummary'];
}

export default function MeasurementsSummary({ latest, sex, selected, onSelect, t }: Props) {
  if (!latest) return null;
  const available = MEASUREMENT_DISPLAY_FIELDS.filter(({ key }) => latest[key] !== null);

  const bodyFatPercent = estimateBodyFatPercent({
    sex,
    neckCm: latest.neck_cm,
    waistCm: latest.waist_cm,
    hipCm: latest.hip_cm,
    heightCm: latest.height_cm,
  });
  const leanMassKg =
    latest.weight_kg !== null ? estimateLeanMassKg(latest.weight_kg, bodyFatPercent) : null;

  if (available.length === 0 && bodyFatPercent === null) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">{t.title}</p>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {available.map(({ key, labelKey, unit }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(selected === key ? null : key)}
            className={`card-brutal card-brutal-tap flex flex-col gap-1 text-left transition-colors hover:border-acid ${
              selected === key ? 'border-acid' : ''
            }`}
          >
            <span className="label-brutal">{t.fields[labelKey]}</span>
            <span className="font-display text-2xl text-paper">
              {latest[key]} <span className="text-sm text-paper-dim">{unit}</span>
            </span>
          </button>
        ))}
        {bodyFatPercent !== null && (
          <button
            type="button"
            onClick={() => onSelect(selected === 'body_fat_percent' ? null : 'body_fat_percent')}
            className={`card-brutal card-brutal-tap flex flex-col gap-1 text-left transition-colors hover:border-acid ${
              selected === 'body_fat_percent' ? 'border-acid' : ''
            }`}
          >
            <span className="label-brutal">{t.fields.bodyFat}</span>
            <span className="font-display text-2xl text-paper">
              {bodyFatPercent} <span className="text-sm text-paper-dim">%</span>
            </span>
          </button>
        )}
        {leanMassKg !== null && (
          <div className="card-brutal flex flex-col gap-1">
            <span className="label-brutal">{t.fields.leanMass}</span>
            <span className="font-display text-2xl text-paper">
              {leanMassKg} <span className="text-sm text-paper-dim">kg</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
```

Nota: `body_fat_percent` es una clave sintética (no una columna de `Measurement`) — el siguiente step maneja ese caso en `ProgressList.tsx` sin tocar `MeasurementsChart`, que sigue recibiendo `points`/`label`/`unit` como hoy.

- [ ] **Step 3: Alimentar el gráfico de %grasa en `ProgressList.tsx`**

En `src/components/react/ProgressList/ProgressList.tsx`, agregar el estado del perfil (sexo) que ya no se estaba leyendo acá, e incorporar el cálculo del historial de %grasa. Cambios:

1. Import nuevo: `import { estimateBodyFatPercent } from '../../../lib/bodyComposition';` y `import { getMyProfile } from '../../../lib/profile';`
2. Nuevo estado: `const [sex, setSex] = useState<'femenino' | 'masculino' | null>(null);`
3. En el `useEffect` que ya carga `measurements`, agregar la carga del perfil en el mismo `Promise.all`:

```ts
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const loggedIn = data.session !== null;
      setIsLoggedIn(loggedIn);
      setAuthChecked(true);
      if (!loggedIn) {
        setLoading(false);
        return;
      }
      const [, , profile] = await Promise.all([
        loadWorkouts(),
        getMyMeasurements().then(setMeasurements),
        getMyProfile(),
      ]);
      setSex(profile?.sex ?? null);
    });
  }, []);
```

4. Pasar `sex` a `MeasurementsSummary` y manejar la selección de `body_fat_percent` para el gráfico — reemplazar el bloque existente de `MeasurementsSummary`/`MeasurementsChart` dentro del primer `CollapsibleSection`:

```tsx
        <MeasurementsSummary
          latest={latestMeasurement}
          sex={sex}
          selected={selectedMeasurement}
          onSelect={setSelectedMeasurement}
          t={t.measurementsSummary}
        />
        {selectedMeasurement === 'body_fat_percent' ? (
          <MeasurementsChart
            label={t.measurementsSummary.fields.bodyFat}
            unit="%"
            points={measurements
              .map((m) => ({
                date: m.date,
                value: estimateBodyFatPercent({
                  sex,
                  neckCm: m.neck_cm,
                  waistCm: m.waist_cm,
                  hipCm: m.hip_cm,
                  heightCm: m.height_cm,
                }),
              }))
              .filter((p): p is { date: string; value: number } => p.value !== null)}
          />
        ) : (
          selectedMeasurementField && (
            <MeasurementsChart
              label={t.measurementsSummary.fields[selectedMeasurementField.labelKey]}
              unit={selectedMeasurementField.unit}
              points={progressForMeasurement(measurements, selectedMeasurementField.key)}
            />
          )
        )}
```

- [ ] **Step 4: Build y chequeo de tipos**

Run: `npm run build && npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 5: Verificación manual**

Con la cuenta de prueba: registrar en Perfil una medición completa (cuello+cintura+cadera+altura, y confirmar que `sex` está seteado en "Soy entrenador"/Perfil). En Progreso → Medidas, confirmar que aparece el tile "% grasa" y "Masa magra", que el gráfico de %grasa se ve al seleccionar ese tile, y que sacando el cuello de una medición (dejarlo vacío) el tile desaparece en vez de mostrar un número.

- [ ] **Step 6: Commit**

```bash
git add src/components/react/ProgressList/MeasurementsSummary.tsx src/components/react/ProgressList/ProgressList.tsx src/i18n/es.ts src/i18n/en.ts
git commit -m "feat(progreso): mostrar %grasa corporal y masa magra estimada en Medidas"
```

---

### Task 6: Ring de adherencia semanal + helper de "PR más reciente"

**Files:**
- Create: `src/components/react/ProgressList/AdherenceRing.tsx`
- Modify: `src/lib/prs.ts` (agregar `mostRecentPR`)

- [ ] **Step 1: Componente del ring**

```tsx
// src/components/react/ProgressList/AdherenceRing.tsx
interface Props {
  daysTrained: number;
  daysElapsed: number;
  label: string;
}

// Anillo de progreso SVG puro (sin librería de gráficos) — el círculo
// completo (2πr con r=42) recorre `daysTrained / daysElapsed` de su
// perímetro con stroke-dasharray, el resto queda en gris tenue.
export default function AdherenceRing({ daysTrained, daysElapsed, label }: Props) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const fraction = daysElapsed > 0 ? daysTrained / daysElapsed : 0;
  const dashOffset = circumference * (1 - fraction);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="96" height="96" viewBox="0 0 96 96" className="shrink-0">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--color-paper-dim)" strokeOpacity="0.2" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="var(--color-acid)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 48 48)"
        />
        <text x="48" y="44" textAnchor="middle" fontSize="20" className="fill-paper" style={{ fontFamily: 'var(--font-display)' }}>
          {daysTrained}/{daysElapsed}
        </text>
        <text x="48" y="62" textAnchor="middle" fontSize="9" letterSpacing="0.05em" className="fill-paper-dim">
          {label}
        </text>
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: `mostRecentPR` en `src/lib/prs.ts`**

Agregar al final del archivo — combina el PR de gimnasio más reciente y el PR de cardio más reciente, devolviendo el que tenga la fecha más nueva (o `null` si no hay ninguno):

```ts
export interface RecentPR {
  kind: 'gym' | 'cardio';
  label: string; // nombre del ejercicio/actividad, ya resuelto por el caller
  date: string;
  display: string; // valor ya formateado para mostrar (ej. "92 kg" o "5:30 /km")
}

// El PR (de cualquier tipo) con la fecha más reciente entre gimnasio y
// cardio — para el tile "PR reciente" de la franja de resumen del
// dashboard. `exerciseNameById`/`activityNameById` deben venir ya resueltos
// por el caller (ProgressList ya tiene ambos mapas armados).
export function mostRecentPR(
  gymPRs: ExercisePR[],
  cardioPRs: CardioPR[],
  exerciseNameById: Map<string, string>,
  activityNameById: Map<string, string>,
  weightUnit: 'kg' | 'lb',
  kgToDisplayFn: (kg: number, unit: 'kg' | 'lb') => number
): RecentPR | null {
  const gymCandidate = gymPRs.reduce<ExercisePR | null>(
    (best, pr) => (!best || pr.date > best.date ? pr : best),
    null
  );
  const cardioCandidate = cardioPRs.reduce<CardioPR | null>(
    (best, pr) => (!best || pr.date > best.date ? pr : best),
    null
  );

  if (!gymCandidate && !cardioCandidate) return null;
  if (gymCandidate && (!cardioCandidate || gymCandidate.date >= cardioCandidate.date)) {
    return {
      kind: 'gym',
      label: exerciseNameById.get(gymCandidate.exerciseId) ?? gymCandidate.exerciseId,
      date: gymCandidate.date,
      display: `${kgToDisplayFn(gymCandidate.weight, weightUnit)} ${weightUnit}`,
    };
  }
  return {
    kind: 'cardio',
    label: activityNameById.get(cardioCandidate!.activityId) ?? cardioCandidate!.activityId,
    date: cardioCandidate!.date,
    display: formatPace(cardioCandidate!.paceMinPerKm),
  };
}
```

- [ ] **Step 3: Build y chequeo de tipos**

Run: `npm run build && npx tsc --noEmit`
Expected: limpio (el componente todavía no se usa en ningún lado, y `mostRecentPR` tampoco — no rompe nada, se conectan en el próximo task).

- [ ] **Step 4: Commit**

```bash
git add src/components/react/ProgressList/AdherenceRing.tsx src/lib/prs.ts
git commit -m "feat(progreso): ring de adherencia semanal y helper de PR más reciente"
```

---

### Task 7: Franja de resumen del dashboard (`ProgressSummaryStrip`)

**Files:**
- Create: `src/components/react/ProgressList/ProgressSummaryStrip.tsx`
- Modify: `src/components/react/ProgressList/ProgressList.tsx`
- Modify: `src/i18n/es.ts` y `src/i18n/en.ts` (nuevo namespace `progreso.summary`)

- [ ] **Step 1: Traducciones**

En `src/i18n/es.ts`, dentro de `progreso` (junto a `measurementsSummary`, por ejemplo antes de esa entrada):

```ts
    summary: {
      adherenceLabel: 'días',
      lastWeight: 'Último peso',
      recentPR: 'PR reciente',
      totalWorkouts: 'Entrenamientos',
      disciplines: 'Disciplinas',
      bodyFat: '% grasa',
    },
```

En `src/i18n/en.ts`, mismo lugar:

```ts
    summary: {
      adherenceLabel: 'days',
      lastWeight: 'Last weight',
      recentPR: 'Recent PR',
      totalWorkouts: 'Workouts',
      disciplines: 'Disciplines',
      bodyFat: '% body fat',
    },
```

- [ ] **Step 2: El componente**

Layout aprobado en el mockup: ring grande a la izquierda, grid de tiles a la derecha. Cada tile solo se dibuja si hay dato — nunca un hueco vacío ni un cero falso.

```tsx
// src/components/react/ProgressList/ProgressSummaryStrip.tsx
import AdherenceRing from './AdherenceRing';
import type { Dictionary } from '../../../i18n/es';

interface Props {
  daysTrained: number;
  daysElapsed: number;
  lastWeightKg: number | null;
  weightUnit: 'kg' | 'lb';
  kgToDisplay: (kg: number, unit: 'kg' | 'lb') => number;
  recentPRLabel: string | null; // "Sentadilla — 92 kg" ya armado por el caller
  totalWorkouts: number;
  disciplineCount: number;
  bodyFatPercent: number | null;
  t: Dictionary['progreso']['summary'];
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-brutal flex flex-col gap-1">
      <span className="label-brutal">{label}</span>
      <span className="font-display text-xl text-paper">{value}</span>
    </div>
  );
}

export default function ProgressSummaryStrip({
  daysTrained,
  daysElapsed,
  lastWeightKg,
  weightUnit,
  kgToDisplay,
  recentPRLabel,
  totalWorkouts,
  disciplineCount,
  bodyFatPercent,
  t,
}: Props) {
  return (
    <div className="flex flex-wrap items-start gap-5">
      <AdherenceRing daysTrained={daysTrained} daysElapsed={daysElapsed} label={t.adherenceLabel} />
      <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
        {lastWeightKg !== null && (
          <Tile label={t.lastWeight} value={`${kgToDisplay(lastWeightKg, weightUnit)} ${weightUnit}`} />
        )}
        {recentPRLabel !== null && <Tile label={t.recentPR} value={recentPRLabel} />}
        {totalWorkouts > 0 && <Tile label={t.totalWorkouts} value={String(totalWorkouts)} />}
        {disciplineCount > 0 && <Tile label={t.disciplines} value={String(disciplineCount)} />}
        {bodyFatPercent !== null && <Tile label={t.bodyFat} value={`${bodyFatPercent} %`} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Conectar en `ProgressList.tsx`**

1. Imports nuevos: `ProgressSummaryStrip`, `weekAdherence` de `../../../lib/adherence`, `mostRecentPR` de `../../../lib/prs` (ya se importan otras cosas de `prs`, agregar a la lista existente).
2. Construir el `Set<string>` de fechas entrenadas y el resto de los datos del resumen, justo después de donde ya se calculan `prs`/`cardioPrs`/`disciplineSummaries` (no antes del `if (!authChecked || loading)`, sino después de ese guard, junto a los demás `const` derivados):

```ts
  const trainedDates = new Set(workouts.map((w) => w.date));
  const adherence = weekAdherence(trainedDates);

  const exerciseNameById = new Map(exercises.map((e) => [e.id, e.name]));
  const activityNameById = new Map(activities.map((a) => [a.id, a.name]));
  const recentPR = mostRecentPR(
    prs,
    cardioPrs,
    exerciseNameById,
    activityNameById,
    weightUnit,
    kgToDisplay
  );
  const disciplineCount = disciplineSummaries.length;
  const bodyFatPercent = estimateBodyFatPercent({
    sex,
    neckCm: latestMeasurement?.neck_cm ?? null,
    waistCm: latestMeasurement?.waist_cm ?? null,
    hipCm: latestMeasurement?.hip_cm ?? null,
    heightCm: latestMeasurement?.height_cm ?? null,
  });
```

`weightUnit` no existe todavía como variable en este componente — agregar `const [weightUnit] = useState(() => getWeightUnit());` junto a los demás `useState`, e importar `getWeightUnit`/`kgToDisplay` de `../../../lib/weightUnit` (mismo patrón que ya usan `ProgressChart`/`PRGrid`).

3. Renderizar la franja arriba del primer `CollapsibleSection`, dentro del `return` principal (después de `<div className="flex flex-col gap-6">`):

```tsx
      <ProgressSummaryStrip
        daysTrained={adherence.daysTrained}
        daysElapsed={adherence.daysElapsed}
        lastWeightKg={latestMeasurement?.weight_kg ?? null}
        weightUnit={weightUnit}
        kgToDisplay={kgToDisplay}
        recentPRLabel={recentPR ? `${recentPR.label} — ${recentPR.display}` : null}
        totalWorkouts={workouts.length}
        disciplineCount={disciplineCount}
        bodyFatPercent={bodyFatPercent}
        t={t.summary}
      />
```

- [ ] **Step 4: Build y chequeo de tipos**

Run: `npm run build && npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 5: Verificación manual**

Con la cuenta de prueba: confirmar que la franja aparece arriba de las 3 secciones colapsables con datos reales (ring de adherencia coincidiendo con lo que ya muestra Rutinas como "Esta semana: X de Y días"), y que cada tile aparece/desaparece según haya o no ese dato (probar quitando temporalmente medidas/entrenamientos si hace falta, y confirmar visualmente, sin dejar cambios permanentes en la cuenta de prueba).

- [ ] **Step 6: Commit**

```bash
git add src/components/react/ProgressList/ProgressSummaryStrip.tsx src/components/react/ProgressList/ProgressList.tsx src/i18n/es.ts src/i18n/en.ts
git commit -m "feat(progreso): franja de resumen del dashboard (ring de adherencia + tiles)"
```

---

### Task 8: Gráfico de progreso — pills de una sola métrica, sin doble eje

**Files:**
- Modify: `src/components/react/ProgressList/ProgressChart.tsx` (reescritura completa del archivo)
- Modify: `src/i18n/es.ts` y `src/i18n/en.ts` (namespace `progreso.progressChart`)

- [ ] **Step 1: Traducciones**

En `src/i18n/es.ts`, reemplazar el namespace `progressChart` existente por esta versión extendida:

```ts
    progressChart: {
      exerciseLabel: 'Ejercicio',
      volume: 'Volumen',
      maxWeight: 'Peso máximo',
      estimated1RM: '1RM estimado',
      info: {
        maxWeight: 'La serie más pesada que levantaste ese día, tal cual la registraste (sin ninguna fórmula).',
        estimated1RM:
          'El peso máximo que probablemente podrías levantar en una repetición, calculado con la fórmula de Epley: peso × (1 + reps/30). Es una estimación, no un peso que hayas levantado literalmente.',
        volume: 'La suma de peso × repeticiones de todas las series de ese ejercicio en la sesión.',
      },
      tooltipPoint: '{metric} — {date}: {value}',
      prBadge: 'PR',
      trendUp: '▲ +{percent}% vs. hace 4 semanas',
      trendDown: '▼ {percent}% vs. hace 4 semanas',
    },
```

En `src/i18n/en.ts`, mismo lugar:

```ts
    progressChart: {
      exerciseLabel: 'Exercise',
      volume: 'Volume',
      maxWeight: 'Max weight',
      estimated1RM: 'Estimated 1RM',
      info: {
        maxWeight: "The heaviest set you lifted that day, exactly as you logged it (no formula involved).",
        estimated1RM:
          'The max weight you could probably lift for one rep, estimated with the Epley formula: weight × (1 + reps/30). It’s an estimate, not a weight you actually lifted.',
        volume: 'The sum of weight × reps across every set of that exercise in the session.',
      },
      tooltipPoint: '{metric} — {date}: {value}',
      prBadge: 'PR',
      trendUp: '▲ +{percent}% vs. 4 weeks ago',
      trendDown: '▼ {percent}% vs. 4 weeks ago',
    },
```

- [ ] **Step 2: Reescribir `ProgressChart.tsx`**

Un `LineChart`/`BarChart` por métrica (no más `ComposedChart` de doble eje), elegido con 3 pills. `Tooltip` de Recharts (ya existía, se mantiene el patrón). Ícono `(i)` cuyo texto depende de la métrica activa. Embellecidos: relleno degradado + glow en las líneas (vía `<defs>`/`filter` de SVG, aplicable dentro de Recharts con `<Area>`/`fill="url(#...)"` y `style={{ filter: '...' }}` en el `<Line>`), punto de PR destacado, badge de tendencia junto al título.

```tsx
import { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ProgressPoint } from '../../../lib/prs';
import { getWeightUnit, kgToDisplay } from '../../../lib/weightUnit';
import type { Dictionary } from '../../../i18n/es';

interface ExerciseInfo {
  id: string;
  name: string;
}

interface Props {
  exerciseId: string;
  points: ProgressPoint[];
  exercises: ExerciseInfo[];
  onSelectExercise: (id: string) => void;
  t: Dictionary['progreso']['progressChart'];
}

type Metric = 'maxWeight' | 'estimated1RM' | 'volume';

const METRIC_COLOR: Record<Metric, string> = {
  maxWeight: 'var(--color-acid)',
  estimated1RM: 'var(--color-blood)',
  volume: 'var(--color-acid)',
};

function ChartTooltip({
  active,
  payload,
  label,
  weightUnit,
  metricLabel,
  format,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  weightUnit: string;
  metricLabel: string;
  format: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const text = format
    .replace('{metric}', metricLabel)
    .replace('{date}', label ?? '')
    .replace('{value}', `${payload[0].value} ${weightUnit}`);
  return (
    <div className="card-brutal font-mono text-sm">
      <p className="text-paper">{text}</p>
    </div>
  );
}

export default function ProgressChart({ exerciseId, points, exercises, onSelectExercise, t }: Props) {
  const [weightUnit] = useState(() => getWeightUnit());
  const [metric, setMetric] = useState<Metric>('maxWeight');
  const exerciseName = exercises.find((e) => e.id === exerciseId)?.name ?? exerciseId;

  const displayPoints = useMemo(
    () =>
      points.map((p) => ({
        date: p.date,
        maxWeight: kgToDisplay(p.maxWeight, weightUnit),
        estimated1RM: kgToDisplay(p.estimated1RM, weightUnit),
        volume: kgToDisplay(p.volume, weightUnit),
      })),
    [points, weightUnit]
  );

  const maxIndex = displayPoints.reduce(
    (best, p, i) => (p[metric] > (displayPoints[best]?.[metric] ?? -Infinity) ? i : best),
    0
  );

  const trend = useMemo(() => {
    if (displayPoints.length === 0) return null;
    const latest = displayPoints[displayPoints.length - 1];
    const latestDate = new Date(latest.date);
    const fourWeeksAgo = new Date(latestDate);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const baseline = displayPoints.find((p) => new Date(p.date) >= fourWeeksAgo);
    if (!baseline || baseline.date === latest.date || baseline[metric] === 0) return null;
    const percent = Math.round(((latest[metric] - baseline[metric]) / baseline[metric]) * 1000) / 10;
    return percent;
  }, [displayPoints, metric]);

  const metricLabel = t[metric];
  const infoText = t.info[metric];

  return (
    <div className="flex flex-col gap-4">
      <label className="flex max-w-xs flex-col gap-2">
        <span className="label-brutal">{t.exerciseLabel}</span>
        <select
          value={exerciseId}
          onChange={(e) => onSelectExercise(e.target.value)}
          className="input-brutal"
        >
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
      </label>
      <div className="card-brutal">
        <div className="mb-1 flex items-center gap-2">
          <p className="font-display text-2xl text-paper">{exerciseName}</p>
          <div className="group relative flex h-5 w-5 items-center justify-center rounded-full border border-paper-dim/60 text-xs text-paper-dim">
            i
            <div className="pointer-events-none absolute left-0 top-6 z-10 w-60 rounded-control border border-paper-dim/40 bg-surface p-3 text-xs text-paper-dim opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              {infoText}
            </div>
          </div>
          {trend !== null && (
            <span className="ml-auto rounded-control border border-acid px-2 py-0.5 font-mono text-xs text-acid">
              {(trend >= 0 ? t.trendUp : t.trendDown).replace('{percent}', String(Math.abs(trend)))}
            </span>
          )}
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {(['maxWeight', 'estimated1RM', 'volume'] as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={m === metric ? 'btn-brutal-sm pill-selected' : 'btn-brutal-sm opacity-60'}
            >
              {t[m]}
            </button>
          ))}
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {metric === 'volume' ? (
              <BarChart data={displayPoints} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid stroke="var(--color-paper-dim)" strokeOpacity={0.2} vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-paper-dim)"
                  tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                />
                <YAxis
                  stroke="var(--color-paper-dim)"
                  tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                  unit={` ${weightUnit}`}
                />
                <Tooltip
                  content={
                    <ChartTooltip weightUnit={weightUnit} metricLabel={metricLabel} format={t.tooltipPoint} />
                  }
                />
                <Bar dataKey="volume" fill="var(--color-acid)" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <ComposedChart data={displayPoints} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id={`fill-${metric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={METRIC_COLOR[metric]} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={METRIC_COLOR[metric]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-paper-dim)" strokeOpacity={0.2} vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-paper-dim)"
                  tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                />
                <YAxis
                  stroke="var(--color-paper-dim)"
                  tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                  unit={` ${weightUnit}`}
                />
                <Tooltip
                  content={
                    <ChartTooltip weightUnit={weightUnit} metricLabel={metricLabel} format={t.tooltipPoint} />
                  }
                />
                <Area
                  type="monotone"
                  dataKey={metric}
                  stroke="none"
                  fill={`url(#fill-${metric})`}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey={metric}
                  stroke={METRIC_COLOR[metric]}
                  strokeWidth={2.5}
                  strokeDasharray={metric === 'estimated1RM' ? '6 5' : undefined}
                  style={{ filter: `drop-shadow(0 0 5px color-mix(in srgb, ${METRIC_COLOR[metric]} 60%, transparent))` }}
                  dot={(props: { cx?: number; cy?: number; index?: number }) => {
                    const isPR = props.index === maxIndex;
                    return (
                      <g key={props.index}>
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={isPR ? 7 : 4}
                          fill={isPR ? '#3fff8f' : METRIC_COLOR[metric]}
                        />
                        {isPR && (
                          <text
                            x={props.cx}
                            y={(props.cy ?? 0) - 14}
                            textAnchor="middle"
                            fontSize="10"
                            className="fill-paper-dim"
                          >
                            {t.prBadge}
                          </text>
                        )}
                      </g>
                    );
                  }}
                  activeDot={{ r: 7 }}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build y chequeo de tipos**

Run: `npm run build && npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 4: Verificación manual**

Con la cuenta de prueba, un ejercicio con varias sesiones registradas: cambiar entre las 3 pills y confirmar que cada una tiene su propio eje/escala (nada de números gigantes en el eje de peso), que el ícono `(i)` cambia de texto según la pill activa, que el punto más alto de peso/1RM se ve destacado en verde con la etiqueta "PR", que aparece el badge de tendencia cuando hay al menos 4 semanas de historial, y que el tooltip al tocar un punto muestra métrica+fecha+valor.

- [ ] **Step 5: Commit**

```bash
git add src/components/react/ProgressList/ProgressChart.tsx src/i18n/es.ts src/i18n/en.ts
git commit -m "feat(progreso): gráfico de ejercicio con pills de una sola métrica, sin doble eje"
```

---

### Task 9: Tarjetas de rutina con bullets por día (reusar `RoutinePreview`)

**Files:**
- Modify: `src/components/react/RoutineManager/RoutineList.tsx`

- [ ] **Step 1: Reemplazar el párrafo corrido por `RoutinePreview`**

Agregar el import:

```ts
import RoutinePreview from './RoutinePreview';
```

Borrar la función `daysSummary` completa (líneas 37-54) — queda sin ningún uso tras este cambio. Junto con ella, `entryActivityId`, `entryTarget`, `targetSummary`, `WEEKDAYS` y `fullActivityName` quedan sin ningún otro uso en este archivo (`type RoutineDays` sí sigue usándose, en `RoutineOption.days` — esa importación se queda). El bloque de import pasa de:

```ts
import {
  entryActivityId,
  entryTarget,
  targetSummary,
  WEEKDAYS,
  type RoutineDays,
} from '../../../lib/weekdays';
import { fullActivityName } from '../../../lib/activities';
```

a:

```ts
import type { RoutineDays } from '../../../lib/weekdays';
```

Reemplazar, dentro de `RoutineCard`:

```tsx
      <p className="font-mono text-sm text-paper-dim">{daysSummary(routine.days, activities, t)}</p>
```

por:

```tsx
      <RoutinePreview days={routine.days} activities={activities} t={t} />
```

- [ ] **Step 2: Build y chequeo de tipos**

Run: `npm run build && npx tsc --noEmit`
Expected: limpio — confirma además que `daysSummary` no quedó referenciada en ningún otro lado del archivo.

- [ ] **Step 3: Verificación manual**

En Rutinas, con una rutina real de varios días/ejercicios: confirmar que la tarjeta ahora muestra cada día con su etiqueta y los ejercicios como bullets, no como un párrafo corrido. Repetir con una rutina predefinida (fuente distinta, mismo componente).

- [ ] **Step 4: Commit**

```bash
git add src/components/react/RoutineManager/RoutineList.tsx
git commit -m "fix(rutinas): mostrar el detalle de la rutina en bullets por día, no en un párrafo corrido"
```

---

### Task 10: Imagen del ejercicio al crear una rutina

**Files:**
- Modify: `src/components/react/RoutineManager/CreateRoutineForm.tsx`

- [ ] **Step 1: Agregar el bloque de imagen en `DayActivityPicker`**

Justo después de `<ActivityPicker .../>` y antes de `{selected?.description && (...)}`:

```tsx
      {selected?.image && (
        <img
          src={`${import.meta.env.BASE_URL}exercises/${selected.image}`}
          alt={selected.name}
          loading="lazy"
          className="aspect-video w-full rounded-card object-cover"
        />
      )}
```

- [ ] **Step 2: Build y chequeo de tipos**

Run: `npm run build && npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 3: Verificación manual**

En Rutinas → crear/editar una rutina propia: seleccionar un ejercicio con foto curada (por ejemplo "Sentadilla" — ver `docs/agents/imagenes-ejercicios-curacion.md` para nombres confirmados) y confirmar que aparece la imagen debajo del picker. Seleccionar uno sin foto curada y confirmar que no queda ningún hueco ni ícono roto.

- [ ] **Step 4: Commit**

```bash
git add src/components/react/RoutineManager/CreateRoutineForm.tsx
git commit -m "feat(rutinas): mostrar la imagen del ejercicio al armar una rutina"
```

---

### Task 11: Revisión holística final

**Files:** ninguno propio — solo verificación sobre el diff completo del branch.

- [ ] **Step 1: Build + tipos + tests limpios de punta a punta**

Run: `npm run build && npx tsc --noEmit && npm test`
Expected: build de 26 páginas, único error preexistente de `ProgressList.tsx`, y todos los tests (`npm test`) en verde, incluidos los 7 nuevos de `body-composition.test.mjs`.

- [ ] **Step 2: Recorrido Playwright completo contra `npx astro preview` + la cuenta de prueba real**

Repasar, en ambos temas (claro/oscuro) y ambos idiomas (es/en):
- Home con y sin sesión (Task 1).
- Progreso: franja de resumen completa, cada sección colapsable, el gráfico con las 3 pills y sus embellecidos, Medidas con %grasa/masa magra.
- Rutinas: tarjetas con bullets, crear/editar una rutina viendo la imagen del ejercicio.
- Sin errores de consola en ninguna pantalla tocada por este branch.

- [ ] **Step 3: Dejar la cuenta de prueba en el estado en que estaba**

Si algún step de verificación manual anterior dejó datos de prueba temporales (mediciones, rutinas) que no correspondían a la cuenta real de pruebas, limpiarlos ahora.

- [ ] **Step 4: Commit final si hubo fixes de esta revisión**

```bash
git add -A
git commit -m "fix: hallazgos de la revisión holística final"
```

(Omitir este step si la revisión no encontró nada para corregir.)
